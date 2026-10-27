"""Candidate work preferences, availability, commitments and employer preferences.

Everything here is the candidate's own private data (RLS: candidate_id = caller). Employers never
read these tables; talent search (app/routers/talent.py) returns a privacy-filtered whitelist.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.audit import audit
from app.deps import Candidate, CurrentUser, Session
from app.errors import ApiError, conflict, not_found
from app.models import (
    AvailabilityException,
    AvailabilityRule,
    CandidateProfile,
    Commitment,
    Consent,
    Employer,
    EmployerPreference,
    WorkPreference,
)
from app.schemas import (
    AvailabilityCheckOut,
    AvailabilityExceptionIn,
    AvailabilityExceptionOut,
    AvailabilityOut,
    AvailabilityRuleOut,
    AvailabilityRulesIn,
    CommitmentIn,
    CommitmentOut,
    ConsentIn,
    EmployerDirectoryItem,
    EmployerPreferenceIn,
    EmployerPreferenceOut,
    WorkKind,
    WorkPreferenceIn,
    WorkPreferenceOut,
    WorkPreferencesOut,
)
from app.services import availability as av
from app.services import conversations as convs

router = APIRouter(prefix="/v1/candidate", tags=["availability"])

_PREF_FIELDS = (
    "enabled",
    "engagement_bases",
    "hours_patterns",
    "min_weekly_hours",
    "max_weekly_hours",
    "min_hourly_pay",
    "max_travel_km",
    "notice_period_days",
    "available_from",
)


# ---- work preferences ----
@router.get("/work-preferences", response_model=WorkPreferencesOut)
async def get_work_preferences(profile: Candidate, session: Session) -> WorkPreferencesOut:
    rows = {
        w.kind: w
        for w in await session.scalars(
            select(WorkPreference).where(WorkPreference.candidate_id == profile.id)
        )
    }
    return WorkPreferencesOut(
        permanent=WorkPreferenceOut.model_validate(rows["permanent"])
        if "permanent" in rows
        else None,
        temporary=WorkPreferenceOut.model_validate(rows["temporary"])
        if "temporary" in rows
        else None,
    )


@router.put("/work-preferences/{kind}", response_model=WorkPreferenceOut)
async def put_work_preference(
    kind: WorkKind, body: WorkPreferenceIn, profile: Candidate, user: CurrentUser, session: Session
) -> WorkPreference:
    """Updates ONE kind. The other kind is never touched, so choosing "Both" keeps each side's
    own answers, and switching one off keeps its fields (it just stops being used)."""
    row = (
        await session.scalars(
            select(WorkPreference).where(
                WorkPreference.candidate_id == profile.id, WorkPreference.kind == kind
            )
        )
    ).one_or_none()
    if row is None:
        row = WorkPreference(candidate_id=profile.id, kind=kind)
        session.add(row)
    was_enabled = row.enabled
    for f in _PREF_FIELDS:
        setattr(row, f, getattr(body, f))
    if was_enabled and not body.enabled and row.discoverable:
        # Turning a kind off withdraws its discovery consent; turning it back on asks again.
        row.discoverable = False
        session.add(Consent(user_id=user.id, kind=f"talent_discovery_{kind}", granted=False))
        await audit(
            session, user.id, f"consent.talent_discovery_{kind}", "user", user.id, granted=False
        )
    await session.flush()
    return row


@router.put("/consents/discovery/{kind}", response_model=WorkPreferenceOut)
async def discovery_consent(
    kind: WorkKind, body: ConsentIn, profile: Candidate, user: CurrentUser, session: Session
) -> WorkPreference:
    """Explicit, per-kind opt-in for employers to find this person. Default off; history kept.
    Discovery additionally needs the master talent-discovery switch to be on."""
    row = (
        await session.scalars(
            select(WorkPreference).where(
                WorkPreference.candidate_id == profile.id, WorkPreference.kind == kind
            )
        )
    ).one_or_none()
    if body.granted and (row is None or not row.enabled):
        raise conflict(
            "kind_not_enabled", f"Turn on {kind} work before allowing employers to find you"
        )
    if row is None:
        raise not_found("work preference")
    row.discoverable = body.granted
    session.add(Consent(user_id=user.id, kind=f"talent_discovery_{kind}", granted=body.granted))
    await audit(
        session, user.id, f"consent.talent_discovery_{kind}", "user", user.id, granted=body.granted
    )
    await session.flush()
    return row


# ---- availability ----
async def _lock(session: Session, profile: CandidateProfile) -> None:
    """Serialise availability writes for one candidate (commitment conflict checks)."""
    await session.execute(
        select(CandidateProfile.id).where(CandidateProfile.id == profile.id).with_for_update()
    )


def _rule(r: AvailabilityRule) -> av.Rule:
    return av.Rule(r.weekday, r.start_time, r.end_time)


def _exc(x: AvailabilityException) -> av.DayException:
    return av.DayException(x.state, x.start_date, x.end_date, x.start_time, x.end_time)


async def load_availability(
    session: Session, candidate_id: uuid.UUID
) -> tuple[list[AvailabilityRule], list[AvailabilityException], list[Commitment]]:
    rules = list(
        await session.scalars(
            select(AvailabilityRule)
            .where(AvailabilityRule.candidate_id == candidate_id)
            .order_by(AvailabilityRule.weekday, AvailabilityRule.start_time)
        )
    )
    exceptions = list(
        await session.scalars(
            select(AvailabilityException)
            .where(AvailabilityException.candidate_id == candidate_id)
            .order_by(AvailabilityException.start_date)
        )
    )
    commitments = list(
        await session.scalars(
            select(Commitment)
            .where(
                Commitment.candidate_id == candidate_id,
                Commitment.ends_at > datetime.now(UTC) - timedelta(days=1),
            )
            .order_by(Commitment.starts_at)
        )
    )
    return rules, exceptions, commitments


async def _availability_out(session: Session, profile: CandidateProfile) -> AvailabilityOut:
    rules, exceptions, commitments = await load_availability(session, profile.id)
    return AvailabilityOut(
        time_zone=profile.time_zone,
        rules=[AvailabilityRuleOut.model_validate(r) for r in rules],
        exceptions=[AvailabilityExceptionOut.model_validate(x) for x in exceptions],
        commitments=[CommitmentOut.model_validate(c) for c in commitments],
        weekly_hours=av.weekly_hours([_rule(r) for r in rules]) if rules else None,
    )


@router.get("/availability", response_model=AvailabilityOut)
async def get_availability(profile: Candidate, session: Session) -> AvailabilityOut:
    return await _availability_out(session, profile)


@router.put("/availability/rules", response_model=AvailabilityOut)
async def put_rules(
    body: AvailabilityRulesIn, profile: Candidate, session: Session
) -> AvailabilityOut:
    """Replaces the whole weekly pattern. Several windows per day are fine; overlaps are not."""
    new = [av.Rule(r.weekday, r.start_time, r.end_time) for r in body.rules]
    if av.overlapping_rules(new):
        raise ApiError(422, "overlapping_windows", "Availability windows must not overlap")
    await session.execute(
        delete(AvailabilityRule).where(AvailabilityRule.candidate_id == profile.id)
    )
    profile.time_zone = body.time_zone
    for r in body.rules:
        session.add(
            AvailabilityRule(
                candidate_id=profile.id,
                weekday=r.weekday,
                start_time=r.start_time,
                end_time=r.end_time,
            )
        )
    await session.flush()
    return await _availability_out(session, profile)


@router.post("/availability/exceptions", response_model=AvailabilityExceptionOut, status_code=201)
async def add_exception(
    body: AvailabilityExceptionIn, profile: Candidate, session: Session
) -> AvailabilityException:
    count = await session.scalar(
        select(func.count())
        .select_from(AvailabilityException)
        .where(AvailabilityException.candidate_id == profile.id)
    )
    if (count or 0) >= 200:
        raise ApiError(422, "too_many_exceptions", "Remove some old exceptions first")
    x = AvailabilityException(candidate_id=profile.id, **body.model_dump())
    session.add(x)
    await session.flush()
    return x


@router.delete("/availability/exceptions/{exception_id}", status_code=204)
async def delete_exception(exception_id: uuid.UUID, profile: Candidate, session: Session) -> None:
    res = await session.execute(
        delete(AvailabilityException)
        .where(
            AvailabilityException.id == exception_id,
            AvailabilityException.candidate_id == profile.id,
        )
        .returning(AvailabilityException.id)
    )
    if res.first() is None:
        raise not_found("exception")


async def _confirmed_clash(
    session: Session,
    candidate_id: uuid.UUID,
    start: datetime,
    end: datetime,
    exclude: uuid.UUID | None,
) -> bool:
    stmt = select(Commitment.id).where(
        Commitment.candidate_id == candidate_id,
        Commitment.status == "confirmed",
        Commitment.starts_at < end,
        Commitment.ends_at > start,
    )
    if exclude:
        stmt = stmt.where(Commitment.id != exclude)
    return (await session.scalars(stmt.limit(1))).first() is not None


async def _flush_commitment(session: Session) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        if getattr(exc.orig, "sqlstate", None) == "23P01":
            raise conflict(
                "commitment_conflict", "That overlaps work you have already confirmed"
            ) from exc
        raise


@router.post("/availability/commitments", response_model=CommitmentOut, status_code=201)
async def add_commitment(body: CommitmentIn, profile: Candidate, session: Session) -> Commitment:
    """Records time the person is not free. A confirmed commitment cannot overlap another confirmed
    one. Applying for a job never creates one: applications do not reserve the worker."""
    await _lock(session, profile)
    if body.starts_at is not None and body.ends_at is not None:
        starts, ends = body.starts_at, body.ends_at
    else:
        assert body.local_date and body.local_start and body.local_end  # noqa: S101
        starts, ends = av.local_interval(
            profile.time_zone, body.local_date, body.local_start, body.local_end
        )
    if body.status == "confirmed" and await _confirmed_clash(
        session, profile.id, starts, ends, None
    ):
        raise conflict("commitment_conflict", "That overlaps work you have already confirmed")
    c = Commitment(
        candidate_id=profile.id,
        source="manual",
        starts_at=starts,
        ends_at=ends,
        status=body.status,
        label=body.label,
        venue_time_zone=body.venue_time_zone,
    )
    session.add(c)
    await _flush_commitment(session)
    return c


@router.post("/availability/commitments/{commitment_id}/confirm", response_model=CommitmentOut)
async def confirm_commitment(
    commitment_id: uuid.UUID, profile: Candidate, session: Session
) -> Commitment:
    await _lock(session, profile)
    c = (
        await session.scalars(
            select(Commitment).where(
                Commitment.id == commitment_id, Commitment.candidate_id == profile.id
            )
        )
    ).one_or_none()
    if c is None:
        raise not_found("commitment")
    if await _confirmed_clash(session, profile.id, c.starts_at, c.ends_at, c.id):
        raise conflict("commitment_conflict", "That overlaps work you have already confirmed")
    c.status = "confirmed"
    await _flush_commitment(session)
    return c


@router.delete("/availability/commitments/{commitment_id}", status_code=204)
async def delete_commitment(commitment_id: uuid.UUID, profile: Candidate, session: Session) -> None:
    res = await session.execute(
        delete(Commitment)
        .where(Commitment.id == commitment_id, Commitment.candidate_id == profile.id)
        .returning(Commitment.id)
    )
    if res.first() is None:
        raise not_found("commitment")


@router.get("/availability/check", response_model=AvailabilityCheckOut)
async def check(
    profile: Candidate,
    session: Session,
    starts_at: datetime,
    ends_at: datetime,
    buffer_minutes: Annotated[int, Query(ge=0, le=240)] = 0,
) -> AvailabilityCheckOut:
    """The person's own view of how their calendar answers a question (also used by tests)."""
    if starts_at.tzinfo is None or ends_at.tzinfo is None or ends_at <= starts_at:
        raise ApiError(422, "bad_interval", "Provide timezone-aware starts_at before ends_at")
    rules, exceptions, commitments = await load_availability(session, profile.id)
    r = av.evaluate(
        time_zone=profile.time_zone,
        rules=[_rule(x) for x in rules],
        exceptions=[_exc(x) for x in exceptions],
        busy=[av.Busy(c.starts_at, c.ends_at, c.status) for c in commitments],
        start=starts_at,
        end=ends_at,
        buffer=timedelta(minutes=buffer_minutes),
    )
    return AvailabilityCheckOut(state=r.state, reason=r.reason)


# ---- employer preferences ----
@router.get("/employer-directory", response_model=list[EmployerDirectoryItem])
async def employer_directory(
    profile: Candidate,
    session: Session,
    q: Annotated[str, Query(min_length=2, max_length=100)],
) -> list[Employer]:
    """Find an employer by name to follow, hide from or mute. Names are already public."""
    pattern = "%" + q.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"
    return list(
        await session.scalars(
            select(Employer).where(Employer.name.ilike(pattern)).order_by(Employer.name).limit(20)
        )
    )


@router.get("/employer-preferences", response_model=list[EmployerPreferenceOut])
async def list_employer_preferences(
    profile: Candidate, session: Session
) -> list[EmployerPreferenceOut]:
    rows = (
        await session.execute(
            select(EmployerPreference, Employer.name)
            .join(Employer, Employer.id == EmployerPreference.employer_id)
            .where(EmployerPreference.candidate_id == profile.id)
            .order_by(Employer.name, EmployerPreference.kind)
        )
    ).all()
    return [
        EmployerPreferenceOut(id=p.id, employer_id=p.employer_id, employer_name=name, kind=p.kind)
        for p, name in rows
    ]


@router.post("/employer-preferences", response_model=EmployerPreferenceOut, status_code=201)
async def add_employer_preference(
    body: EmployerPreferenceIn, profile: Candidate, user: CurrentUser, session: Session
) -> EmployerPreferenceOut:
    emp = await session.get(Employer, body.employer_id)
    if emp is None:
        raise not_found("employer")
    # follow contradicts hide_from and block; mute is independent.
    opposite = {
        "follow": ("hide_from", "block"),
        "hide_from": ("follow",),
        "block": ("follow",),
    }.get(body.kind, ())
    if opposite:
        await session.execute(
            delete(EmployerPreference).where(
                EmployerPreference.candidate_id == profile.id,
                EmployerPreference.employer_id == emp.id,
                EmployerPreference.kind.in_(opposite),
            )
        )
    existing = (
        await session.scalars(
            select(EmployerPreference).where(
                EmployerPreference.candidate_id == profile.id,
                EmployerPreference.employer_id == emp.id,
                EmployerPreference.kind == body.kind,
            )
        )
    ).one_or_none()
    pref = existing or EmployerPreference(
        candidate_id=profile.id, employer_id=emp.id, kind=body.kind
    )
    if existing is None:
        session.add(pref)
    await session.flush()
    if body.kind == "block":
        # Close threads, cut the employer's access to them, end pending invitations, stop nudges.
        await convs.apply_block(session, profile.id, emp.id, user)
    return EmployerPreferenceOut(
        id=pref.id, employer_id=emp.id, employer_name=emp.name, kind=pref.kind
    )


@router.delete("/employer-preferences/{pref_id}", status_code=204)
async def delete_employer_preference(
    pref_id: uuid.UUID, profile: Candidate, session: Session
) -> None:
    res = await session.execute(
        delete(EmployerPreference)
        .where(EmployerPreference.id == pref_id, EmployerPreference.candidate_id == profile.id)
        .returning(EmployerPreference.id)
    )
    if res.first() is None:
        raise not_found("preference")
