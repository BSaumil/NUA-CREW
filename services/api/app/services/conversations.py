"""Consent-based messaging (ADR-010).

A conversation exists only after the candidate accepted an invitation, and there is exactly one per
invitation. Plain text only (clients must render it as text, never HTML). Acceptance grants no
contact details, resume access or calendar visibility. Blocking closes the thread, removes the
employer's access to it (history stays for the candidate and authorised support) and stops
notifications. Presence and read receipts are not exposed.
"""

import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.errors import ApiError, conflict, forbidden, not_found
from app.models import (
    Conversation,
    Employer,
    EmployerMembership,
    Invitation,
    Message,
    MessageReport,
    Notification,
    User,
)
from app.rls import system_scope
from app.services.notify import notify


def _hash(body: str) -> str:
    return hashlib.sha256(json.dumps(body).encode()).hexdigest()


async def get_for_side(
    session: AsyncSession, conversation_id: uuid.UUID, *, candidate_id: uuid.UUID | None = None,
    employer_id: uuid.UUID | None = None, lock: bool = False,
) -> Conversation:  # fmt: skip
    """RLS already hides other people's threads; the explicit filter is the second wall."""
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    if candidate_id is not None:
        stmt = stmt.where(Conversation.candidate_id == candidate_id)
    if employer_id is not None:
        stmt = stmt.where(Conversation.employer_id == employer_id, Conversation.employer_access)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    conv = (await session.scalars(stmt)).one_or_none()
    if conv is None:
        raise not_found("conversation")
    return conv


async def post_message(
    session: AsyncSession,
    conv: Conversation,
    *,
    role: str,
    user: User,
    body: str,
    client_key: str | None,
) -> tuple[Message, bool]:
    text_ = body.strip()
    if not text_:
        raise ApiError(422, "empty_message", "Write a message first")
    req = _hash(text_)
    if client_key:
        prior = (
            await session.scalars(
                select(Message).where(
                    Message.conversation_id == conv.id,
                    Message.sender_role == role,
                    Message.client_key == client_key,
                )
            )
        ).one_or_none()
        if prior is not None:
            if prior.request_hash != req:
                raise conflict(
                    "idempotency_conflict", "That client_key was used for a different message"
                )
            return prior, False
    # Re-read the state under a lock so a concurrent block/close wins deterministically.
    locked = (
        await session.scalars(
            select(Conversation)
            .where(Conversation.id == conv.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).one()
    if locked.status != "open" or (role == "employer" and not locked.employer_access):
        raise conflict("conversation_closed", "This conversation is closed")
    inv = await session.get(Invitation, locked.invitation_id)
    if inv is None or inv.status != "accepted":
        raise conflict("conversation_closed", "This conversation is closed")
    if role == "employer":
        emp = await session.get(Employer, locked.employer_id)
        if emp is None or emp.verification_status != "verified":
            raise forbidden("This organisation can't send messages right now")
    msg = Message(
        conversation_id=locked.id, sender_role=role, sender_user_id=user.id, body=text_,
        client_key=client_key, request_hash=req,
    )  # fmt: skip
    try:
        async with session.begin_nested():
            session.add(msg)
            await session.flush()
    except IntegrityError:
        prior = (
            await session.scalars(
                select(Message).where(
                    Message.conversation_id == locked.id,
                    Message.sender_role == role,
                    Message.client_key == client_key,
                )
            )
        ).one_or_none()
        if prior is not None and prior.request_hash == req:
            return prior, False
        raise conflict(
            "idempotency_conflict", "That client_key was used for a different message"
        ) from None
    locked.last_message_at = msg.created_at
    await session.flush()
    await _notify_other_side(session, locked, inv, role)
    return msg, True


async def _notify_other_side(
    session: AsyncSession, conv: Conversation, inv: Invitation, role: str
) -> None:
    """One unread nudge per conversation, generic text, none if the thread is closed/blocked."""
    async with system_scope(session):
        if role == "employer":
            from app.models import CandidateProfile

            target = await session.scalar(
                select(CandidateProfile.user_id).where(CandidateProfile.id == conv.candidate_id)
            )
        else:
            member = await session.scalar(
                select(EmployerMembership.user_id).where(
                    EmployerMembership.employer_id == conv.employer_id,
                    EmployerMembership.user_id == inv.sent_by,
                )
            )
            target = member  # the teammate who sent the invitation, if still a member
        if target is None:
            return
        already = await session.scalar(
            select(Notification.id).where(
                Notification.user_id == target,
                Notification.kind == "message_received",
                Notification.read_at.is_(None),
                Notification.data["conversation_id"].astext == str(conv.id),
            )
        )
        if already is not None:
            return
    await notify(
        session, target, "message_received", "You have a new message",
        "Open NUA CREW to read it.", conversation_id=str(conv.id),
    )  # fmt: skip


async def page_messages(
    session: AsyncSession, conv: Conversation, before: uuid.UUID | None, limit: int
) -> tuple[list[Message], uuid.UUID | None]:
    """Oldest-first page of the newest `limit` messages before the cursor message."""
    stmt = select(Message).where(Message.conversation_id == conv.id)
    if before is not None:
        ref = (
            await session.scalars(
                select(Message).where(Message.id == before, Message.conversation_id == conv.id)
            )
        ).one_or_none()
        if ref is None:
            raise ApiError(422, "bad_cursor", "Unknown cursor")
        stmt = stmt.where(
            (Message.created_at < ref.created_at)
            | ((Message.created_at == ref.created_at) & (Message.id < ref.id))
        )
    rows = list(
        await session.scalars(
            stmt.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
        )
    )
    more = len(rows) > limit
    page = rows[:limit]
    page.reverse()
    return page, (page[0].id if more and page else None)


async def mark_read(session: AsyncSession, conv: Conversation, role: str) -> None:
    now = datetime.now(UTC)
    if role == "candidate":
        conv.candidate_read_at = now
    else:
        conv.employer_read_at = now
    await session.flush()
    # clear the matching nudge so the next message can notify again
    uid = None
    if role == "candidate":
        from app.models import CandidateProfile

        uid = await session.scalar(
            select(CandidateProfile.user_id).where(CandidateProfile.id == conv.candidate_id)
        )
    if uid is not None:
        await session.execute(
            update(Notification)
            .where(
                Notification.user_id == uid,
                Notification.kind == "message_received",
                Notification.read_at.is_(None),
                Notification.data["conversation_id"].astext == str(conv.id),
            )
            .values(read_at=now)
        )


async def close_by_candidate(session: AsyncSession, conv: Conversation, user: User) -> Conversation:
    locked = await get_for_side(session, conv.id, candidate_id=conv.candidate_id, lock=True)
    if locked.status == "open":
        locked.status, locked.closed_reason = "closed", "candidate_closed"
        await session.flush()
        await audit(session, user.id, "conversation.closed", "conversation", locked.id)
    return locked


async def apply_block(
    session: AsyncSession, candidate_id: uuid.UUID, employer_id: uuid.UUID, user: User
) -> None:
    """Candidate blocked an employer: close threads, hide them from the employer, end pending
    invitations. History stays for the candidate and authorised support."""
    async with system_scope(session):
        convs = list(
            await session.scalars(
                select(Conversation)
                .where(
                    Conversation.candidate_id == candidate_id,
                    Conversation.employer_id == employer_id,
                )
                .with_for_update()
            )
        )
        for c in convs:
            c.employer_access = False
            if c.status == "open":
                c.status, c.closed_reason = "closed", "blocked"
        pending = list(
            await session.scalars(
                select(Invitation)
                .where(
                    Invitation.candidate_id == candidate_id,
                    Invitation.employer_id == employer_id,
                    Invitation.status == "pending",
                )
                .with_for_update()
            )
        )
        now = datetime.now(UTC)
        for inv in pending:
            inv.status, inv.responded_at = "declined", now
        # no further nudges from this employer
        ids = [str(c.id) for c in convs]
        if ids:
            await session.execute(
                update(Notification)
                .where(
                    Notification.kind == "message_received",
                    Notification.read_at.is_(None),
                    Notification.data["conversation_id"].astext.in_(ids),
                )
                .values(read_at=now)
            )
    await audit(
        session, user.id, "candidate.blocked_employer", "employer", employer_id,
        conversations=len(convs), invitations=len(pending),
    )  # fmt: skip


async def report(
    session: AsyncSession, conv: Conversation, *, role: str, user: User, reason: str,
    message_id: uuid.UUID | None,
) -> MessageReport:  # fmt: skip
    excerpt = None
    if message_id is not None:
        m = (
            await session.scalars(
                select(Message).where(Message.id == message_id, Message.conversation_id == conv.id)
            )
        ).one_or_none()
        if m is None:
            raise not_found("message")
        excerpt = m.body[:500]
    r = MessageReport(
        conversation_id=conv.id, message_id=message_id, reporter_user_id=user.id,
        reporter_role=role, reason=reason.strip()[:500], excerpt=excerpt,
    )  # fmt: skip
    session.add(r)
    await session.flush()
    await audit(session, user.id, "message.reported", "conversation", conv.id, report_id=str(r.id))
    return r


async def unread_counts(session: AsyncSession, candidate_id: uuid.UUID) -> tuple[int, int]:
    """(unread invitations, conversations with unread messages) for the candidate."""
    now = datetime.now(UTC)
    inv = await session.scalar(
        select(func.count())
        .select_from(Invitation)
        .where(
            Invitation.candidate_id == candidate_id,
            Invitation.status == "pending",
            Invitation.expires_at > now,
            Invitation.read_at.is_(None),
        )
    )
    unread = await session.scalar(
        select(func.count(func.distinct(Message.conversation_id)))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Conversation.candidate_id == candidate_id,
            Message.sender_role == "employer",
            (Conversation.candidate_read_at.is_(None))
            | (Message.created_at > Conversation.candidate_read_at),
        )
    )
    return inv or 0, unread or 0
