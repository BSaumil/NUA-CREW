"""Hiring invitations (ADR-010).

An invitation is an expression of hiring interest in a person who chose to be found. It is NOT an
application, an employment offer, a shift hold or a booking, and it never reserves availability.

Every state change locks the row (SELECT ... FOR UPDATE), re-reads the status and writes one valid
terminal state, so accept / withdraw / expiry races end in exactly one outcome. Eligibility is
re-checked at send time: an old search result or opaque reference is not permanent authorisation.
Refusals about the candidate's side share one generic error so an employer cannot learn whether a
person withdrew consent, hid from them, paused invitations or was rate limited.
"""

import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.config import get_settings
from app.errors import ApiError, conflict, forbidden, not_found
from app.models import (
    CandidateProfile,
    Conversation,
    Employer,
    EmployerPreference,
    Invitation,
    Job,
    JobVersion,
    TalentExposure,
    User,
    WorkPreference,
)
from app.rls import system_scope
from app.schemas import InvitationIn
from app.services.jobs import is_open
from app.services.notify import notify
from app.services.talent import candidate_ref, display_name

UNAVAILABLE = ApiError(409, "candidate_unavailable", "This person can't be invited right now.")
STALE_REF = ApiError(
    404, "result_unavailable", "That search result is no longer available. Search again."
)


def _sha(obj: object) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()


async def _advisory(session: AsyncSession, key: str) -> None:
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": key})


def terms_of(job: Job, employer_name: str) -> dict[str, Any]:
    """The facts a candidate must see before accepting. Compared by hash to detect changes."""

    def d(v: object) -> str | None:
        return None if v is None else str(v)

    return {
        "business": employer_name,
        "job_id": str(job.id),
        "title": job.title,
        "suburb": job.suburb,
        "state": job.state,
        "employment_type": job.employment_type,
        "engagement_basis": job.engagement_basis,
        "duration_type": job.duration_type,
        "hours_pattern": job.hours_pattern,
        "min_weekly_hours": d(job.min_weekly_hours),
        "max_weekly_hours": d(job.max_weekly_hours),
        "start_date": d(job.start_date),
        "end_date": d(job.end_date),
        "pay_min": d(job.pay_min),
        "pay_max": d(job.pay_max),
        "pay_period": job.pay_period,
        "pay_basis": job.pay_basis,
        "super_included": job.super_included,
    }


def terms_hash(terms: dict[str, Any]) -> str:
    return _sha(terms)[:32]


def effective_status(inv: Invitation, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    return "expired" if inv.status == "pending" and inv.expires_at <= now else inv.status


async def lock_invitation(session: AsyncSession, invitation_id: uuid.UUID) -> Invitation | None:
    return (
        await session.scalars(
            select(Invitation)
            .where(Invitation.id == invitation_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).one_or_none()


async def expire_if_due(session: AsyncSession, inv: Invitation) -> bool:
    """Persist expiry for a locked invitation and COMMIT it. Returns True if it expired just now.

    The caller is about to refuse the action with an error, which would roll the request back and
    lose the transition; committing first keeps it. Nothing may query after a True result (the
    transaction-local RLS identity ends with the commit), so callers raise immediately."""
    if inv.status == "pending" and inv.expires_at <= datetime.now(UTC):
        inv.status = "expired"
        inv.responded_at = inv.expires_at
        await session.flush()
        await audit(session, None, "invitation.expired", "invitation", inv.id)
        await session.commit()
        return True
    return False


async def sweep_expired(session: AsyncSession, limit: int = 500) -> int:
    """Worker step: expire what nobody has touched. Safe to run late or twice."""
    async with system_scope(session):
        rows = list(
            await session.scalars(
                select(Invitation)
                .where(Invitation.status == "pending", Invitation.expires_at <= func.now())
                .order_by(Invitation.expires_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        )
        for inv in rows:
            inv.status = "expired"
            inv.responded_at = inv.expires_at
    for inv in rows:
        await audit(session, None, "invitation.expired", "invitation", inv.id)
    return len(rows)


# ---------------------------------------------------------------- send
async def resolve_ref(session: AsyncSession, employer_id: uuid.UUID, ref: str) -> uuid.UUID | None:
    """Server-side only: map this employer's opaque reference back to a candidate they were
    recently shown. Another employer's reference, an old one or a guess resolves to nothing."""
    ttl = timedelta(days=get_settings().talent_ref_ttl_days)
    async with system_scope(session):
        ids = list(
            await session.scalars(
                select(TalentExposure.candidate_id).where(
                    TalentExposure.employer_id == employer_id,
                    TalentExposure.last_shown_at > datetime.now(UTC) - ttl,
                )
            )
        )
    for cid in ids:
        if hmac.compare_digest(candidate_ref(employer_id, cid), ref):
            return cid
    return None


async def send(
    session: AsyncSession,
    *,
    user: User,
    employer: Employer,
    body: InvitationIn,
    idempotency_key: str | None,
) -> tuple[Invitation, bool]:
    """Returns (invitation, created). created=False means an identical earlier request."""
    s = get_settings()
    if employer.verification_status != "verified":
        raise forbidden("This organisation must be verified before it can send invitations")
    req_hash = _sha(
        [body.ref, str(body.job_id), body.kind, body.note.strip(), body.expires_in_days]
    )
    if idempotency_key:
        prior = (
            await session.scalars(
                select(Invitation).where(
                    Invitation.employer_id == employer.id,
                    Invitation.idempotency_key == idempotency_key,
                )
            )
        ).one_or_none()
        if prior is not None:
            if prior.request_hash != req_hash:
                raise conflict(
                    "idempotency_conflict", "That Idempotency-Key was used with different details"
                )
            return prior, False

    job = (
        await session.scalars(
            select(Job).where(Job.id == body.job_id, Job.employer_id == employer.id)
        )
    ).one_or_none()
    if job is None:
        raise not_found("job")
    if not is_open(job):
        raise conflict("job_not_open", "Only an open, published job can be used for an invitation")

    candidate_id = await resolve_ref(session, employer.id, body.ref)
    if candidate_id is None:
        raise STALE_REF

    now = datetime.now(UTC)
    day = now - timedelta(hours=24)
    async with system_scope(session):
        # Atomic quotas: serialise on the employer, then the recipient, always in that order.
        await _advisory(session, f"inv-employer:{employer.id}")
        await _advisory(session, f"inv-candidate:{candidate_id}")

        row = (
            await session.execute(
                select(CandidateProfile, User.is_active)
                .join(User, User.id == CandidateProfile.user_id)
                .where(CandidateProfile.id == candidate_id)
            )
        ).one_or_none()
        if row is None or not row[1]:
            raise UNAVAILABLE
        profile = row[0]
        pref = (
            await session.scalars(
                select(WorkPreference).where(
                    WorkPreference.candidate_id == candidate_id, WorkPreference.kind == body.kind
                )
            )
        ).one_or_none()
        blocked = await session.scalar(
            select(EmployerPreference.id).where(
                EmployerPreference.candidate_id == candidate_id,
                EmployerPreference.employer_id == employer.id,
                EmployerPreference.kind.in_(("hide_from", "block")),
            )
        )
        consented = (
            profile.discoverable
            and profile.invitations_enabled
            and pref is not None
            and pref.enabled
            and pref.discoverable
        )
        if not consented or blocked is not None:
            raise UNAVAILABLE
        received = await session.scalar(
            select(func.count())
            .select_from(Invitation)
            .where(Invitation.candidate_id == candidate_id, Invitation.created_at > day)
        )
        if (received or 0) >= s.invitation_candidate_daily_limit:
            raise UNAVAILABLE

        sent_today = await session.scalar(
            select(func.count())
            .select_from(Invitation)
            .where(Invitation.employer_id == employer.id, Invitation.created_at > day)
        )
        if (sent_today or 0) >= s.invitation_employer_daily_limit:
            raise ApiError(429, "invitation_quota", "Your organisation has reached today's limit")
        for_job = await session.scalar(
            select(func.count())
            .select_from(Invitation)
            .where(Invitation.job_id == job.id, Invitation.created_at > day)
        )
        if (for_job or 0) >= s.invitation_job_daily_limit:
            raise ApiError(429, "invitation_quota", "This job has reached today's invitation limit")

        cooldown = now - timedelta(days=s.invitation_decline_cooldown_days)
        declined = await session.scalar(
            select(Invitation.id).where(
                Invitation.employer_id == employer.id,
                Invitation.candidate_id == candidate_id,
                Invitation.status == "declined",
                Invitation.responded_at > cooldown,
            )
        )
        if declined is not None:
            raise conflict(
                "cooldown",
                f"This person declined an invitation from your organisation recently. "
                f"Please wait {s.invitation_decline_cooldown_days} days.",
            )

        live = await session.scalar(
            select(Invitation.id).where(
                Invitation.employer_id == employer.id,
                Invitation.candidate_id == candidate_id,
                Invitation.job_id == job.id,
                Invitation.status.in_(("pending", "accepted")),
            )
        )
        if live is not None:
            raise conflict("already_invited", "This person has already been invited to this job")

        version = await session.scalar(
            select(func.coalesce(func.max(JobVersion.version), 0)).where(
                JobVersion.job_id == job.id
            )
        )
        terms = terms_of(job, employer.name)
        inv = Invitation(
            employer_id=employer.id,
            candidate_id=candidate_id,
            job_id=job.id,
            sent_by=user.id,
            kind=body.kind,
            note=body.note.strip(),
            job_version=version or 0,
            snapshot={
                **terms,
                "terms_hash": terms_hash(terms),
                "candidate_label": display_name(profile.full_name),
            },
            expires_at=now
            + timedelta(days=body.expires_in_days or s.invitation_default_expiry_days),
            idempotency_key=idempotency_key,
            request_hash=req_hash,
        )
        try:
            async with session.begin_nested():
                session.add(inv)
                await session.flush()
        except IntegrityError as e:
            # A concurrent identical request or a live duplicate won the race.
            if idempotency_key:
                prior = (
                    await session.scalars(
                        select(Invitation).where(
                            Invitation.employer_id == employer.id,
                            Invitation.idempotency_key == idempotency_key,
                        )
                    )
                ).one_or_none()
                if prior is not None and prior.request_hash == req_hash:
                    return prior, False
            raise conflict(
                "already_invited", "This person has already been invited to this job"
            ) from e
        candidate_user = profile.user_id

    # Same transaction as the invitation: the notification row is the durable outbox entry the
    # push worker delivers after commit. Generic text only; details need an authenticated fetch.
    await notify(
        session,
        candidate_user,
        "invitation_received",
        "You have a new invitation",
        "Open NUA CREW to review it.",
        invitation_id=str(inv.id),
    )
    await audit(
        session, user.id, "invitation.sent", "invitation", inv.id,
        employer_id=str(employer.id), job_id=str(job.id), kind=body.kind,
    )  # fmt: skip
    return inv, True


# ---------------------------------------------------------------- candidate / employer actions
async def current_terms(
    session: AsyncSession, inv: Invitation
) -> tuple[dict[str, Any] | None, bool]:
    """Terms as the job stands now, and whether the job is still open."""
    job = await session.get(Job, inv.job_id)
    if job is None:
        return None, False
    emp = await session.get(Employer, inv.employer_id)
    return terms_of(job, emp.name if emp else inv.snapshot.get("business", "")), is_open(job)


async def accept(
    session: AsyncSession,
    invitation_id: uuid.UUID,
    candidate_id: uuid.UUID,
    user: User,
    reviewed: str,
) -> tuple[Invitation, uuid.UUID]:
    inv = await lock_invitation(session, invitation_id)
    if inv is None or inv.candidate_id != candidate_id:
        raise not_found("invitation")
    if inv.status == "accepted":  # repeat: same conversation, nothing new
        existing = await session.scalar(
            select(Conversation.id).where(Conversation.invitation_id == inv.id)
        )
        assert existing is not None  # noqa: S101
        return inv, existing
    if await expire_if_due(session, inv):
        raise conflict("invitation_expired", "This invitation has expired")
    if inv.status != "pending":
        raise conflict(f"invitation_{inv.status}", f"This invitation was {inv.status}")
    terms, open_ = await current_terms(session, inv)
    employer = await session.get(Employer, inv.employer_id)
    if terms is None or not open_:
        raise conflict("job_closed", "This job is no longer open, so it can't be accepted")
    if employer is None or employer.verification_status != "verified":
        raise conflict("employer_unavailable", "This employer can't take part right now")
    if terms_hash(terms) != reviewed:
        raise conflict(
            "terms_changed", "The job details changed. Please review the latest details."
        )
    inv.status, inv.responded_at, inv.accepted_snapshot = "accepted", datetime.now(UTC), terms
    async with system_scope(session):
        conv = Conversation(
            invitation_id=inv.id, employer_id=inv.employer_id, candidate_id=inv.candidate_id,
            job_id=inv.job_id,
        )  # fmt: skip
        session.add(conv)
    await session.flush()
    await audit(session, user.id, "invitation.accepted", "invitation", inv.id)
    if inv.sent_by:
        await notify(
            session, inv.sent_by, "invitation_accepted", "An invitation was accepted",
            "Open NUA CREW Hire to continue.", invitation_id=str(inv.id),
        )  # fmt: skip
    return inv, conv.id


async def decline(
    session: AsyncSession, invitation_id: uuid.UUID, candidate_id: uuid.UUID, user: User
) -> Invitation:
    inv = await lock_invitation(session, invitation_id)
    if inv is None or inv.candidate_id != candidate_id:
        raise not_found("invitation")
    if inv.status == "declined":
        return inv
    if await expire_if_due(session, inv):
        raise conflict("invitation_expired", "This invitation has expired")
    if inv.status != "pending":
        raise conflict(f"invitation_{inv.status}", f"This invitation was {inv.status}")
    inv.status, inv.responded_at = "declined", datetime.now(UTC)
    await session.flush()
    await audit(session, user.id, "invitation.declined", "invitation", inv.id)
    return inv


async def withdraw(
    session: AsyncSession, invitation_id: uuid.UUID, employer_id: uuid.UUID, user: User
) -> Invitation:
    inv = await lock_invitation(session, invitation_id)
    if inv is None or inv.employer_id != employer_id:
        raise not_found("invitation")
    if inv.status == "withdrawn":
        return inv
    if await expire_if_due(session, inv):
        raise conflict("invitation_expired", "This invitation has already expired")
    if inv.status != "pending":
        raise conflict(f"invitation_{inv.status}", f"This invitation was {inv.status}")
    inv.status, inv.responded_at = "withdrawn", datetime.now(UTC)
    await session.flush()
    await audit(session, user.id, "invitation.withdrawn", "invitation", inv.id)
    return inv
