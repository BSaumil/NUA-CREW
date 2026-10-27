"""Candidate side of invitations and messaging. Own rows only (RLS + explicit filters)."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import select

from app.config import get_settings
from app.deps import Candidate, CurrentUser, Session
from app.errors import not_found
from app.models import Conversation, Employer, Invitation, Job, Message
from app.ratelimit import get_limiter
from app.schemas import (
    ConversationOut,
    InboxSummary,
    InvitationAcceptIn,
    InvitationList,
    InvitationOut,
    InvitationSettingsIn,
    InvitationSettingsOut,
    InvitationStatus,
    InvitationTerms,
    MessageIn,
    MessageOut,
    MessagePage,
    ReportIn,
    ReportOut,
)
from app.services import conversations as convs
from app.services import invitations as inv_svc

router = APIRouter(prefix="/v1/candidate", tags=["inbox"])

ACCEPTANCE_NOTE = (
    "Accepting opens a conversation with this employer. It is not an application, does not accept "
    "any employment, does not reserve a shift and shares no contact details, resume or calendar."
)


async def _out(
    session: Session, inv: Invitation, conversation_id: uuid.UUID | None = None
) -> InvitationOut:
    status = inv_svc.effective_status(inv)
    terms, open_ = await inv_svc.current_terms(session, inv)
    cur_hash = inv_svc.terms_hash(terms) if terms else None
    changed = terms is not None and cur_hash != inv.snapshot.get("terms_hash")
    if conversation_id is None and inv.status == "accepted":
        conversation_id = await session.scalar(
            select(Conversation.id).where(Conversation.invitation_id == inv.id)
        )
    return InvitationOut(
        id=inv.id, employer_id=inv.employer_id, status=status, kind=inv.kind, note=inv.note,
        created_at=inv.created_at,
        expires_at=inv.expires_at, responded_at=inv.responded_at, unread=inv.read_at is None,
        terms=InvitationTerms.model_validate(inv.snapshot),
        current_terms=InvitationTerms.model_validate(terms) if terms else None,
        current_terms_hash=cur_hash, terms_changed=changed, job_open=open_,
        can_accept=status == "pending" and open_, conversation_id=conversation_id,
        acceptance_note=ACCEPTANCE_NOTE,
    )  # fmt: skip


@router.get("/inbox/summary", response_model=InboxSummary)
async def inbox_summary(profile: Candidate, session: Session) -> InboxSummary:
    i, c = await convs.unread_counts(session, profile.id)
    return InboxSummary(unread_invitations=i, unread_conversations=c)


@router.get("/invitation-settings", response_model=InvitationSettingsOut)
async def get_invitation_settings(profile: Candidate) -> InvitationSettingsOut:
    return InvitationSettingsOut(invitations_enabled=profile.invitations_enabled)


@router.put("/invitation-settings", response_model=InvitationSettingsOut)
async def put_invitation_settings(
    body: InvitationSettingsIn, profile: Candidate, user: CurrentUser, session: Session
) -> InvitationSettingsOut:
    """Pausing stops NEW invitations. Pending invitations and open conversations are unchanged;
    end a conversation or block an employer separately."""
    from app.audit import audit

    profile.invitations_enabled = body.enabled
    await session.flush()
    await audit(session, user.id, "invitations.setting", "user", user.id, enabled=body.enabled)
    return InvitationSettingsOut(invitations_enabled=profile.invitations_enabled)


@router.get("/invitations", response_model=InvitationList)
async def list_invitations(
    profile: Candidate,
    session: Session,
    status: InvitationStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> InvitationList:
    stmt = select(Invitation).where(
        Invitation.candidate_id == profile.id, inv_svc.status_filter(status)
    )
    rows = list(await session.scalars(stmt.order_by(Invitation.created_at.desc()).limit(limit)))
    items = [await _out(session, r) for r in rows]
    unread = sum(1 for i in items if i.unread and i.status == "pending")
    return InvitationList(items=items, unread=unread)


async def _mine(session: Session, profile_id: uuid.UUID, invitation_id: uuid.UUID) -> Invitation:
    inv = await inv_svc.lock_invitation(session, invitation_id)
    if inv is None or inv.candidate_id != profile_id:
        raise not_found("invitation")
    return inv


@router.get("/invitations/{invitation_id}", response_model=InvitationOut)
async def get_invitation(
    invitation_id: uuid.UUID, profile: Candidate, session: Session
) -> InvitationOut:
    inv = await _mine(session, profile.id, invitation_id)
    # Expiry is enforced on read through the effective status; the worker persists it later.
    if inv.read_at is None:
        inv.read_at = datetime.now(UTC)
    await session.flush()
    return await _out(session, inv)


@router.post("/invitations/{invitation_id}/accept", response_model=InvitationOut)
async def accept_invitation(
    invitation_id: uuid.UUID,
    body: InvitationAcceptIn,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> InvitationOut:
    inv, conv_id = await inv_svc.accept(session, invitation_id, profile.id, user, body.terms_hash)
    return await _out(session, inv, conv_id)


@router.post("/invitations/{invitation_id}/decline", response_model=InvitationOut)
async def decline_invitation(
    invitation_id: uuid.UUID, profile: Candidate, user: CurrentUser, session: Session
) -> InvitationOut:
    """No reason is asked for."""
    inv = await inv_svc.decline(session, invitation_id, profile.id, user)
    return await _out(session, inv)


# ---- conversations ----
@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(profile: Candidate, session: Session) -> list[ConversationOut]:
    rows = (
        await session.execute(
            select(Conversation, Job.title, Employer.name)
            .join(Job, Job.id == Conversation.job_id)
            .join(Employer, Employer.id == Conversation.employer_id)
            .where(Conversation.candidate_id == profile.id)
            .order_by(
                Conversation.last_message_at.desc().nulls_last(), Conversation.created_at.desc()
            )
            .limit(100)
        )
    ).all()
    latest = await _latest_by_role(session, [c.id for c, _, _ in rows], "employer")
    return [
        ConversationOut(
            id=c.id,
            employer_id=c.employer_id,
            invitation_id=c.invitation_id,
            job_id=c.job_id,
            job_title=title,
            counterpart=emp,
            status=c.status,
            closed_reason=c.closed_reason,
            last_message_at=c.last_message_at,
            unread=(t := latest.get(c.id)) is not None
            and (c.candidate_read_at is None or t > c.candidate_read_at),
        )  # fmt: skip
        for c, title, emp in rows
    ]


async def _latest_by_role(
    session: Session, ids: list[uuid.UUID], role: str
) -> dict[uuid.UUID, datetime]:
    from sqlalchemy import func

    if not ids:
        return {}
    res = await session.execute(
        select(Message.conversation_id, func.max(Message.created_at))
        .where(Message.conversation_id.in_(ids), Message.sender_role == role)
        .group_by(Message.conversation_id)
    )
    return {cid: t for cid, t in res.all()}


async def _conv(
    session: Session, profile_id: uuid.UUID, conversation_id: uuid.UUID
) -> Conversation:
    return await convs.get_for_side(session, conversation_id, candidate_id=profile_id)


def _msg_out(m: Message, role: str) -> MessageOut:
    return MessageOut(
        id=m.id, sender_role=m.sender_role, mine=m.sender_role == role, body=m.body,
        created_at=m.created_at,
    )  # fmt: skip


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
async def candidate_messages(
    conversation_id: uuid.UUID,
    profile: Candidate,
    session: Session,
    before: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> MessagePage:
    conv = await _conv(session, profile.id, conversation_id)
    page, nxt = await convs.page_messages(session, conv, before, limit)
    return MessagePage(items=[_msg_out(m, "candidate") for m in page], next_before=nxt)


@router.post(
    "/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=201
)
async def candidate_send(
    conversation_id: uuid.UUID,
    body: MessageIn,
    response: Response,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> MessageOut:
    conv = await _conv(session, profile.id, conversation_id)
    await get_limiter().check(f"msg:{user.id}", get_settings().message_limit_per_minute, 60)
    msg, created = await convs.post_message(
        session, conv, role="candidate", user=user, body=body.body, client_key=body.client_key
    )
    if not created:
        response.status_code = 200
    return _msg_out(msg, "candidate")


@router.post("/conversations/{conversation_id}/read", status_code=204)
async def candidate_read(conversation_id: uuid.UUID, profile: Candidate, session: Session) -> None:
    conv = await _conv(session, profile.id, conversation_id)
    await convs.mark_read(session, conv, "candidate")


@router.post("/conversations/{conversation_id}/close", response_model=ConversationOut)
async def candidate_close(
    conversation_id: uuid.UUID, profile: Candidate, user: CurrentUser, session: Session
) -> ConversationOut:
    """End an accepted conversation. Separate from pausing invitations and from blocking."""
    conv = await _conv(session, profile.id, conversation_id)
    conv = await convs.close_by_candidate(session, conv, user)
    job = await session.get(Job, conv.job_id)
    emp = await session.get(Employer, conv.employer_id)
    return ConversationOut(
        id=conv.id, employer_id=conv.employer_id, invitation_id=conv.invitation_id,
        job_id=conv.job_id,
        job_title=job.title if job else "", counterpart=emp.name if emp else "",
        status=conv.status, closed_reason=conv.closed_reason,
        last_message_at=conv.last_message_at, unread=False,
    )  # fmt: skip


@router.post("/conversations/{conversation_id}/report", response_model=ReportOut, status_code=201)
async def candidate_report(
    conversation_id: uuid.UUID,
    body: ReportIn,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> ReportOut:
    conv = await _conv(session, profile.id, conversation_id)
    await get_limiter().check(f"report:{user.id}", 20, 3600)
    r = await convs.report(
        session, conv, role="candidate", user=user, reason=body.reason, message_id=body.message_id
    )
    return ReportOut(id=r.id, status=r.status)
