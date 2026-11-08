"""The introductory free-advertising offer: a transparent, auditable, capped grant per publish.

While paid advertising is off, a verified employer may publish a job for `intro_offer_days` at no
charge. Each controlled publish records one IntroAdGrant (terms version, window, who). There is no
card, no order, no renewal and no later charge: the grant ends and the job expires with it. The
owner opens it by approving the offer terms and setting NUA_INTRO_OFFER_ENABLED; until then
publishing is closed while registration and drafting work.

Fair use is a pair of per-employer caps (live grants, and grants started in 30 days). The numbers
are proposals in config for the owner to confirm. Verification, email, role and pay checks are
unchanged and run before this.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text

from app.audit import audit
from app.config import get_settings
from app.deps import Session
from app.errors import ApiError, conflict
from app.models import IntroAdGrant, Job
from app.rls import system_scope

WINDOW_DAYS = 30


@dataclass(frozen=True)
class OfferStatus:
    enabled: bool
    days: int
    terms_version: str
    max_active: int
    active_used: int
    max_per_30_days: int
    used_30_days: int


async def _counts(session: Session, employer_id: uuid.UUID, now: datetime) -> tuple[int, int]:
    base = select(func.count(IntroAdGrant.id)).where(
        IntroAdGrant.employer_id == employer_id, IntroAdGrant.revoked_at.is_(None)
    )
    active = await session.scalar(base.where(IntroAdGrant.ends_at > now))
    recent = await session.scalar(
        base.where(IntroAdGrant.starts_at > now - timedelta(days=WINDOW_DAYS))
    )
    return int(active or 0), int(recent or 0)


async def status(session: Session, employer_id: uuid.UUID) -> OfferStatus:
    s = get_settings()
    active, recent = await _counts(session, employer_id, datetime.now(UTC))
    return OfferStatus(
        enabled=s.intro_offer_enabled,
        days=s.intro_offer_days,
        terms_version=s.intro_offer_terms_version,
        max_active=s.intro_offer_max_active_per_employer,
        active_used=active,
        max_per_30_days=s.intro_offer_max_per_30_days,
        used_30_days=recent,
    )


async def active_grant(session: Session, job_id: uuid.UUID, now: datetime) -> IntroAdGrant | None:
    return await session.scalar(
        select(IntroAdGrant)
        .where(
            IntroAdGrant.job_id == job_id,
            IntroAdGrant.revoked_at.is_(None),
            IntroAdGrant.starts_at <= now,
            IntroAdGrant.ends_at > now,
        )
        .order_by(IntroAdGrant.ends_at.desc())
        .limit(1)
    )


async def ensure_grant(
    session: Session, job: Job, employer_id: uuid.UUID, user_id: uuid.UUID, now: datetime
) -> IntroAdGrant:
    """Return the job's live grant, or create one if the offer is open and the caps allow."""
    s = get_settings()
    if not s.intro_offer_enabled:
        raise conflict(
            "publishing_not_open",
            "Publishing is not open yet. Your draft is saved and you can keep editing it.",
        )
    # Serialise grants per employer so two simultaneous publishes cannot both slip under a cap.
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"intro:{employer_id}"}
    )
    existing = await active_grant(session, job.id, now)
    if existing is not None:
        return existing  # republishing inside its live window does not use another grant
    active, recent = await _counts(session, employer_id, now)
    if active >= s.intro_offer_max_active_per_employer:
        raise ApiError(
            409,
            "intro_limit_reached",
            f"The introductory offer allows {s.intro_offer_max_active_per_employer} live job ads "
            "at a time. Close one, or wait for one to end, then publish this one.",
        )
    if recent >= s.intro_offer_max_per_30_days:
        raise ApiError(
            409,
            "intro_limit_reached",
            f"The introductory offer allows {s.intro_offer_max_per_30_days} job ads in 30 days. "
            "Please try again later.",
        )
    grant = IntroAdGrant(
        employer_id=employer_id,
        job_id=job.id,
        granted_by=user_id,
        terms_version=s.intro_offer_terms_version,
        starts_at=now,
        ends_at=now + timedelta(days=s.intro_offer_days),
    )
    async with system_scope(session):
        session.add(grant)
        await session.flush()
    await audit(
        session,
        user_id,
        "job.intro_granted",
        "job",
        job.id,
        terms_version=grant.terms_version,
        ends_at=grant.ends_at.isoformat(),
    )
    return grant
