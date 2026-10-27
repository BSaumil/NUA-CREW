"""Consent-based talent search for verified employers (ADR-009).

Privacy rules enforced here, each with a test:
- A candidate appears only if the master discovery switch AND the per-kind switch are on and that
  kind of work is enabled. Profile completeness never opts anyone in.
- A candidate who chose "hide from" this employer never appears for it (best effort: we match the
  employer record, so we cannot promise anonymity from a business operating under another entity).
- The search runs in system scope (employers have no direct read access to these tables) and
  returns ONLY a whitelist: first name + last initial, headline, suburb, skills, coarse
  availability for the asked window, compatibility labels and what we do not know.
- Never returned: the private asking floor, the calendar, commitments, exceptions, blocked
  employers, email, exact location, or the account id (the reference is per-employer and opaque).
- Results are not ranked: ordered by an arbitrary stable key. "Prefers your business" is a label,
  not a boost. Nothing here scores, rejects or hires anyone.
"""

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import exists, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import ApiError
from app.models import (
    AvailabilityException,
    AvailabilityRule,
    CandidateProfile,
    CandidateSkill,
    Commitment,
    EmployerPreference,
    Job,
    Skill,
    TalentExposure,
    User,
    WorkPreference,
)
from app.rls import system_scope
from app.schemas import (
    TalentAvailability,
    TalentCandidateOut,
    TalentSearchIn,
    TalentSearchOut,
)
from app.services import availability as av
from app.services.jobs import slugify
from app.services.matching import _TO_HOURLY

BATCH = 50
MAX_SCANNED = 400  # per request: a search cannot be used to walk the whole directory in one call

NOTES = [
    "Only people who chose to be found for this kind of work are listed.",
    "Results are not ranked and are not a prediction of who will accept or be a good hire.",
    "Availability is what the person shared, answered only for the time you asked about.",
    "Hiring decisions are yours. NUA CREW does not screen, score or reject people.",
]
INVITE_REASON = (
    "Invitations are not available yet. There is no consent-based messaging path, so nobody "
    "can be contacted from this page."
)


def candidate_ref(employer_id: uuid.UUID, candidate_id: uuid.UUID) -> str:
    """Opaque per-employer reference: the same person looks different to different employers."""
    key = get_settings().jwt_secret.encode()
    msg = f"talent:{employer_id}:{candidate_id}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()[:24]


def display_name(full_name: str) -> str:
    parts = full_name.split()
    if len(parts) <= 1:
        return parts[0] if parts else "Candidate"
    return f"{parts[0]} {parts[-1][0].upper()}."


def hourly_equivalent(job: Job) -> Decimal | None:
    if job.pay_basis != "disclosed" or job.pay_max is None or job.pay_period is None:
        return None
    return job.pay_max / _TO_HOURLY[job.pay_period]


def _offset(after: str | None) -> int:
    if not after:
        return 0
    try:
        n = int(after.removeprefix("o"))
    except ValueError:
        return 0
    return max(0, min(n, 100_000))


async def search(
    session: AsyncSession, employer_id: uuid.UUID, body: TalentSearchIn, job: Job | None
) -> tuple[TalentSearchOut, list[uuid.UUID]]:
    """Returns (response, candidate profile ids shown) so the caller can audit exposure."""
    hourly = hourly_equivalent(job) if job is not None else None
    offset = _offset(body.after)
    shown: list[TalentCandidateOut] = []
    shown_ids: list[uuid.UUID] = []
    scanned = 0
    more = False

    async with system_scope(session):
        base = (
            select(CandidateProfile, WorkPreference)
            .join(WorkPreference, WorkPreference.candidate_id == CandidateProfile.id)
            .join(User, User.id == CandidateProfile.user_id)
            .where(
                User.is_active.is_(True),
                CandidateProfile.discoverable.is_(True),
                WorkPreference.kind == body.kind,
                WorkPreference.enabled.is_(True),
                WorkPreference.discoverable.is_(True),
                ~exists().where(
                    EmployerPreference.candidate_id == CandidateProfile.id,
                    EmployerPreference.employer_id == employer_id,
                    EmployerPreference.kind.in_(("hide_from", "block")),
                ),
            )
            .order_by(CandidateProfile.id)
        )
        if body.suburb:
            base = base.where(func.lower(CandidateProfile.suburb) == body.suburb.lower())
        if body.state:
            base = base.where(CandidateProfile.state == body.state)
        if body.skills:
            slugs = [slugify(s) for s in body.skills]
            base = base.where(
                exists()
                .where(CandidateSkill.candidate_id == CandidateProfile.id)
                .where(CandidateSkill.skill_id == Skill.id)
                .where(Skill.slug.in_(slugs))
            )

        while len(shown) < body.limit and scanned < MAX_SCANNED:
            rows = (await session.execute(base.limit(BATCH).offset(offset))).all()
            if not rows:
                break
            ids = [p.id for p, _ in rows]
            ctx = await _load_context(session, employer_id, ids)
            for i, (profile, pref) in enumerate(rows):
                offset += 1
                scanned += 1
                item = _build(profile, pref, ctx, employer_id, body, hourly, job)
                if item is not None:
                    shown.append(item)
                    shown_ids.append(profile.id)
                if len(shown) >= body.limit:
                    more = i < len(rows) - 1 or len(rows) == BATCH
                    break
            else:
                more = len(rows) == BATCH
                continue
            break
        else:
            more = scanned >= MAX_SCANNED

    allowed = await record_exposures(session, employer_id, shown_ids)
    keep = [i for i, cid in enumerate(shown_ids) if cid in allowed]
    shown = [shown[i] for i in keep]
    shown_ids = [shown_ids[i] for i in keep]
    return (
        TalentSearchOut(
            items=shown,
            next_after=f"o{offset}" if more else None,
            invite_available=False,
            invite_unavailable_reason=INVITE_REASON,
            notes=NOTES,
        ),
        shown_ids,
    )


async def record_exposures(
    session: AsyncSession, employer_id: uuid.UUID, ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    """Enforce the per-employer daily budget of DISTINCT candidates shown, atomically (advisory
    lock, so teammates and multiple API instances share it), and remember who was shown so an
    invitation can later resolve the opaque reference. Residual limit: a budgeted employer can still
    probe up to that many distinct people per day; this narrows, not removes, that risk."""
    if not ids:
        return set()
    budget = get_settings().talent_daily_candidate_budget
    now = datetime.now(UTC)
    day = now - timedelta(hours=24)
    async with system_scope(session):
        await session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
            {"k": f"talent-budget:{employer_id}"},
        )
        recent = set(
            await session.scalars(
                select(TalentExposure.candidate_id).where(
                    TalentExposure.employer_id == employer_id, TalentExposure.last_shown_at > day
                )
            )
        )
        fresh = [i for i in ids if i not in recent]
        room = max(0, budget - len(recent))
        allowed = {i for i in ids if i in recent} | set(fresh[:room])
        if fresh and not allowed:
            raise ApiError(
                429,
                "discovery_budget",
                "Your organisation has seen the maximum number of different people for today",
            )
        for cid in allowed:
            stmt = pg_insert(TalentExposure).values(
                employer_id=employer_id, candidate_id=cid, first_shown_at=now, last_shown_at=now
            )
            await session.execute(
                stmt.on_conflict_do_update(
                    index_elements=["employer_id", "candidate_id"], set_={"last_shown_at": now}
                )
            )
    return allowed


class _Ctx:
    def __init__(self) -> None:
        self.skills: dict[uuid.UUID, list[str]] = {}
        self.kinds: dict[uuid.UUID, list[str]] = {}
        self.rules: dict[uuid.UUID, list[av.Rule]] = {}
        self.exceptions: dict[uuid.UUID, list[av.DayException]] = {}
        self.busy: dict[uuid.UUID, list[av.Busy]] = {}
        self.follows: set[uuid.UUID] = set()


async def _load_context(
    session: AsyncSession, employer_id: uuid.UUID, ids: list[uuid.UUID]
) -> _Ctx:
    c = _Ctx()
    for cid, name in (
        await session.execute(
            select(CandidateSkill.candidate_id, Skill.name)
            .join(Skill, Skill.id == CandidateSkill.skill_id)
            .where(CandidateSkill.candidate_id.in_(ids))
            .order_by(Skill.name)
        )
    ).all():
        c.skills.setdefault(cid, []).append(name)
    for cid, kind in (
        await session.execute(
            select(WorkPreference.candidate_id, WorkPreference.kind).where(
                WorkPreference.candidate_id.in_(ids),
                WorkPreference.enabled.is_(True),
                WorkPreference.discoverable.is_(True),
            )
        )
    ).all():
        c.kinds.setdefault(cid, []).append(kind)
    for r in await session.scalars(
        select(AvailabilityRule).where(AvailabilityRule.candidate_id.in_(ids))
    ):
        c.rules.setdefault(r.candidate_id, []).append(av.Rule(r.weekday, r.start_time, r.end_time))
    for x in await session.scalars(
        select(AvailabilityException).where(AvailabilityException.candidate_id.in_(ids))
    ):
        c.exceptions.setdefault(x.candidate_id, []).append(
            av.DayException(x.state, x.start_date, x.end_date, x.start_time, x.end_time)
        )
    for b in await session.scalars(
        select(Commitment).where(
            Commitment.candidate_id.in_(ids), Commitment.ends_at > func.now() - timedelta(days=1)
        )
    ):
        c.busy.setdefault(b.candidate_id, []).append(av.Busy(b.starts_at, b.ends_at, b.status))
    c.follows = set(
        await session.scalars(
            select(EmployerPreference.candidate_id).where(
                EmployerPreference.candidate_id.in_(ids),
                EmployerPreference.employer_id == employer_id,
                EmployerPreference.kind == "follow",
            )
        )
    )
    return c


def _build(
    profile: CandidateProfile,
    pref: WorkPreference,
    ctx: _Ctx,
    employer_id: uuid.UUID,
    body: TalentSearchIn,
    hourly: Decimal | None,
    job: Job | None,
) -> TalentCandidateOut | None:
    cid = profile.id
    rules = ctx.rules.get(cid, [])
    unknowns: list[str] = []

    # Availability for the asked window, collapsed to what an employer may know.
    if body.starts_at and body.ends_at:
        r = av.evaluate(
            time_zone=profile.time_zone,
            rules=rules,
            exceptions=ctx.exceptions.get(cid, []),
            busy=ctx.busy.get(cid, []),
            start=body.starts_at,
            end=body.ends_at,
        )
        if r.state == "available":
            avail = TalentAvailability(
                state="available", reason="Shared availability covers this time"
            )
        elif r.state == "unknown":
            avail = TalentAvailability(state="unknown", reason="No availability shared")
            unknowns.append("Availability not shared")
        else:  # unavailable, held, confirmed: never say which
            avail = TalentAvailability(state="unavailable", reason="Not available for this time")
            if body.availability == "available_or_unknown":
                return None
    else:
        avail = TalentAvailability(state="not_requested", reason="No time window was asked about")

    # Weekly hours fit.
    if body.min_weekly_hours is None:
        hours = "not_requested"
    else:
        wanted = float(body.min_weekly_hours)
        if pref.max_weekly_hours is not None and wanted > float(pref.max_weekly_hours):
            hours = "incompatible"
        elif not rules:
            hours = "unknown"
            unknowns.append("Weekly availability not shared")
        else:
            hours = "compatible" if av.weekly_hours(rules) >= wanted else "incompatible"

    # Pay fit. Only "compatible" or "not confirmed": a precise "too low" answer would let an
    # employer probe the private floor by repeated searches.
    if job is None:
        pay = "not_requested"
    elif hourly is not None and pref.min_hourly_pay is not None and pref.min_hourly_pay <= hourly:
        pay = "compatible"
    else:
        pay = "not_confirmed"
        unknowns.append("Pay fit not confirmed")

    permanent = body.kind == "permanent"
    return TalentCandidateOut(
        ref=candidate_ref(employer_id, cid),
        display_name=display_name(profile.full_name),
        headline=(profile.headline or None) and profile.headline[:120],
        area=", ".join(x for x in (profile.suburb, profile.state) if x) or None,
        skills=ctx.skills.get(cid, [])[:8],
        kinds_offered=sorted(ctx.kinds.get(cid, [])),
        availability=avail,
        hours_compat=hours,
        pay_compat=pay,
        notice_period_days=pref.notice_period_days if permanent else None,
        available_from=pref.available_from if permanent else None,
        prefers_your_business=cid in ctx.follows,
        unknowns=unknowns,
    )
