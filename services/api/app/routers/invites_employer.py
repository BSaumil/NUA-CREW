"""Employer side of invitations and messaging. Every route needs a membership dependency (404 for
non-members); every query is filtered by the employer."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Header, Query, Response
from sqlalchemy import select

from app.config import get_settings
from app.deps import CurrentUser, Recruiter, Session, Viewer
from app.errors import not_found
from app.models import Conversation, Employer, Invitation, Job, Message
from app.ratelimit import get_limiter
from app.schemas import (
    ConversationOut,
    EmployerInvitationOut,
    InvitationIn,
    InvitationStatus,
    MessageIn,
    MessageOut,
    MessagePage,
    ReportIn,
    ReportOut,
)
from app.services import conversations as convs
from app.services import invitations as inv_svc
from app.services.talent import candidate_ref

router = APIRouter(prefix="/v1/employers", tags=["invitations"])


async def _emp_out(
    session: Session, inv: Invitation, job_title: str | None = None
) -> EmployerInvitationOut:
    if job_title is None:
        job = await session.get(Job, inv.job_id)
        job_title = job.title if job else inv.snapshot.get("title", "")
    conv_id = None
    if inv.status == "accepted":
        conv_id = await session.scalar(
            select(Conversation.id).where(Conversation.invitation_id == inv.id)
        )
    return EmployerInvitationOut(
        id=inv.id, status=inv_svc.effective_status(inv),
        kind=inv.kind, job_id=inv.job_id, job_title=job_title, note=inv.note,
        created_at=inv.created_at, expires_at=inv.expires_at, responded_at=inv.responded_at,
        candidate_label=inv.snapshot.get("candidate_label", "Candidate"),
        candidate_ref=candidate_ref(inv.employer_id, inv.candidate_id), conversation_id=conv_id,
    )  # fmt: skip


@router.post("/{employer_id}/invitations", response_model=EmployerInvitationOut, status_code=201)
async def send_invitation(
    employer_id: uuid.UUID,
    body: InvitationIn,
    response: Response,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=80)] = None,
) -> EmployerInvitationOut:
    employer = await session.get(Employer, employer_id)
    if employer is None:
        raise not_found("employer")
    await get_limiter().check(f"invite:{employer_id}", 120, 3600)
    inv, created = await inv_svc.send(
        session, user=user, employer=employer, body=body, idempotency_key=idempotency_key
    )
    if not created:
        response.status_code = 200
    return await _emp_out(session, inv)


@router.get("/{employer_id}/invitations", response_model=list[EmployerInvitationOut])
async def list_sent(
    employer_id: uuid.UUID,
    _: Viewer,
    session: Session,
    status: InvitationStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[EmployerInvitationOut]:
    rows = (
        await session.execute(
            select(Invitation, Job.title)
            .join(Job, Job.id == Invitation.job_id)
            .where(Invitation.employer_id == employer_id, inv_svc.status_filter(status))
            .order_by(Invitation.created_at.desc())
            .limit(limit)
        )
    ).all()
    out = [await _emp_out(session, inv, title) for inv, title in rows]
    return out


async def _own(session: Session, employer_id: uuid.UUID, invitation_id: uuid.UUID) -> Invitation:
    inv = (
        await session.scalars(
            select(Invitation).where(
                Invitation.id == invitation_id, Invitation.employer_id == employer_id
            )
        )
    ).one_or_none()
    if inv is None:
        raise not_found("invitation")
    return inv


@router.get("/{employer_id}/invitations/{invitation_id}", response_model=EmployerInvitationOut)
async def get_sent(
    employer_id: uuid.UUID, invitation_id: uuid.UUID, _: Viewer, session: Session
) -> EmployerInvitationOut:
    return await _emp_out(session, await _own(session, employer_id, invitation_id))


@router.post(
    "/{employer_id}/invitations/{invitation_id}/withdraw", response_model=EmployerInvitationOut
)
async def withdraw_invitation(
    employer_id: uuid.UUID,
    invitation_id: uuid.UUID,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> EmployerInvitationOut:
    inv = await inv_svc.withdraw(session, invitation_id, employer_id, user)
    return await _emp_out(session, inv)


# ---- conversations ----
async def _conv(
    session: Session, employer_id: uuid.UUID, conversation_id: uuid.UUID
) -> Conversation:
    return await convs.get_for_side(session, conversation_id, employer_id=employer_id)


@router.get("/{employer_id}/conversations", response_model=list[ConversationOut])
async def employer_conversations(
    employer_id: uuid.UUID, _: Viewer, session: Session
) -> list[ConversationOut]:
    from sqlalchemy import func

    rows = (
        await session.execute(
            select(Conversation, Job.title, Invitation.snapshot)
            .join(Job, Job.id == Conversation.job_id)
            .join(Invitation, Invitation.id == Conversation.invitation_id)
            .where(Conversation.employer_id == employer_id, Conversation.employer_access)
            .order_by(
                Conversation.last_message_at.desc().nulls_last(), Conversation.created_at.desc()
            )
            .limit(100)
        )
    ).all()
    ids = [c.id for c, _, _ in rows]
    latest: dict[uuid.UUID, object] = {}
    if ids:
        res = await session.execute(
            select(Message.conversation_id, func.max(Message.created_at))
            .where(Message.conversation_id.in_(ids), Message.sender_role == "candidate")
            .group_by(Message.conversation_id)
        )
        latest = {cid: t for cid, t in res.all()}
    return [
        ConversationOut(
            id=c.id,
            employer_id=c.employer_id,
            invitation_id=c.invitation_id,
            job_id=c.job_id,
            job_title=title,
            counterpart=snap.get("candidate_label", "Candidate"),
            status=c.status,
            closed_reason=None if c.closed_reason == "blocked" else c.closed_reason,
            last_message_at=c.last_message_at,
            unread=(t := latest.get(c.id)) is not None
            and (c.employer_read_at is None or t > c.employer_read_at),
        )  # fmt: skip
        for c, title, snap in rows
    ]


@router.get("/{employer_id}/conversations/{conversation_id}/messages", response_model=MessagePage)
async def employer_messages(
    employer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    _: Viewer,
    session: Session,
    before: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> MessagePage:
    conv = await _conv(session, employer_id, conversation_id)
    page, nxt = await convs.page_messages(session, conv, before, limit)
    return MessagePage(
        items=[
            MessageOut(
                id=m.id, sender_role=m.sender_role, mine=m.sender_role == "employer",
                body=m.body, created_at=m.created_at,
            )
            for m in page
        ],
        next_before=nxt,
    )  # fmt: skip


@router.post(
    "/{employer_id}/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=201,
)
async def employer_send(
    employer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    body: MessageIn,
    response: Response,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> MessageOut:
    conv = await _conv(session, employer_id, conversation_id)
    await get_limiter().check(f"msg:{user.id}", get_settings().message_limit_per_minute, 60)
    msg, created = await convs.post_message(
        session, conv, role="employer", user=user, body=body.body, client_key=body.client_key
    )
    if not created:
        response.status_code = 200
    return MessageOut(
        id=msg.id, sender_role="employer", mine=True, body=msg.body, created_at=msg.created_at
    )


@router.post("/{employer_id}/conversations/{conversation_id}/read", status_code=204)
async def employer_read(
    employer_id: uuid.UUID, conversation_id: uuid.UUID, _: Viewer, session: Session
) -> None:
    conv = await _conv(session, employer_id, conversation_id)
    await convs.mark_read(session, conv, "employer")


@router.post(
    "/{employer_id}/conversations/{conversation_id}/report",
    response_model=ReportOut,
    status_code=201,
)
async def employer_report(
    employer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    body: ReportIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> ReportOut:
    conv = await _conv(session, employer_id, conversation_id)
    await get_limiter().check(f"report:{user.id}", 20, 3600)
    r = await convs.report(
        session, conv, role="employer", user=user, reason=body.reason, message_id=body.message_id
    )
    return ReportOut(id=r.id, status=r.status)
