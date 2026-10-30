"""Check-in/out, corrections and no-show handling for confirmed shift bookings.

Events are append-only. A correction is a request that the business approves or rejects; the
original event is never edited. There are no automatic monetary penalties anywhere in this flow.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.deps import Candidate, CurrentUser, Recruiter, Session, Viewer
from app.errors import conflict
from app.models import (
    CandidateProfile,
    EmployerMembership,
    Shift,
    ShiftAttendanceEvent,
    ShiftBooking,
    ShiftTimesheetVersion,
)
from app.rls import system_scope
from app.routers.shifts import _booking, _out, _shift
from app.services.attendance import derive, events_for, pending_requests
from app.services.notify import notify
from app.services.scheduling import worked_minutes
from app.shift_schemas import (
    BookingOut,
    CorrectionIn,
    CorrectionReviewIn,
    ReasonIn,
    TimesheetVersionOut,
)

router = APIRouter(prefix="/v1", tags=["attendance"])

EARLY_CHECK_IN = timedelta(hours=1)
NO_SHOW_GRACE = timedelta(minutes=30)
CORRECTION_WINDOW = timedelta(hours=12)


async def _team_users(session: AsyncSession, employer_id: uuid.UUID) -> list[uuid.UUID]:
    async with system_scope(session):
        members = await session.scalars(
            select(EmployerMembership.user_id).where(
                EmployerMembership.employer_id == employer_id,
                EmployerMembership.role.in_(("owner", "recruiter")),
            )
        )
        return list(members)


def _add(
    session: AsyncSession,
    booking: ShiftBooking,
    shift: Shift,
    kind: str,
    role: str,
    **extra: object,
) -> ShiftAttendanceEvent:
    event = ShiftAttendanceEvent(
        booking_id=booking.id, kind=kind, actor_role=role, time_zone=shift.time_zone, **extra
    )
    session.add(event)
    return event


async def _locked(
    session: AsyncSession,
    bid: uuid.UUID,
    *,
    cid: uuid.UUID | None = None,
    eid: uuid.UUID | None = None,
) -> tuple[ShiftBooking, Shift]:
    row = await _booking(session, bid, cid=cid, eid=eid)
    await session.refresh(row, with_for_update=True)
    shift = await _shift(session, row.shift_id)
    if row.status != "confirmed" or shift.status != "open":
        raise conflict("attendance_unavailable", "Attendance applies to confirmed, live shifts")
    return row, shift


async def _flush_events(session: AsyncSession, booking: ShiftBooking) -> None:
    await session.flush()
    await session.refresh(booking)


@router.post("/candidate/shift-bookings/{booking_id}/check-in", response_model=BookingOut)
async def check_in(
    booking_id: uuid.UUID, profile: Candidate, user: CurrentUser, session: Session
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, cid=profile.id)
        events = await events_for(session, row.id)
        state = derive(events, shift.time_zone)
        now = datetime.now(UTC)
        if state.status == "no_show":
            raise conflict("marked_no_show", "Ask the business to review the no-show mark")
        if state.check_in_at is None:
            if now < shift.starts_at - EARLY_CHECK_IN or now > shift.ends_at:
                raise conflict(
                    "check_in_window",
                    "Check in opens one hour before the shift and closes at its end",
                )
            _add(session, row, shift, "check_in", "candidate")
            await _flush_events(session, row)
            await audit(session, user.id, "attendance.check_in", "booking", row.id)
    return await _out(session, row)


@router.post("/candidate/shift-bookings/{booking_id}/check-out", response_model=BookingOut)
async def check_out(
    booking_id: uuid.UUID, profile: Candidate, user: CurrentUser, session: Session
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, cid=profile.id)
        state = derive(await events_for(session, row.id), shift.time_zone)
        if state.status == "no_show":
            raise conflict("marked_no_show", "Ask the business to review the no-show mark")
        if state.check_in_at is None:
            raise conflict("not_checked_in", "Check in first, or request a correction")
        if state.check_out_at is None:
            if datetime.now(UTC) > shift.ends_at + CORRECTION_WINDOW:
                raise conflict("check_out_window", "Request a correction for this shift")
            _add(session, row, shift, "check_out", "candidate")
            await _flush_events(session, row)
            await audit(session, user.id, "attendance.check_out", "booking", row.id)
    return await _out(session, row)


@router.post(
    "/candidate/shift-bookings/{booking_id}/attendance-corrections", response_model=BookingOut
)
async def request_correction(
    booking_id: uuid.UUID,
    body: CorrectionIn,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, cid=profile.id)
        claimed = body.claimed_at.astimezone(UTC)
        if (
            claimed < shift.starts_at - CORRECTION_WINDOW
            or claimed > shift.ends_at + CORRECTION_WINDOW
        ):
            raise conflict("correction_window", "That time is too far from the shift; ask support")
        if claimed > datetime.now(UTC):
            raise conflict("correction_future", "A correction cannot be in the future")
        events = await events_for(session, row.id)
        state = derive(events, shift.time_zone)
        if any(e.claim_kind == body.claim_kind for e in pending_requests(events)):
            raise conflict("correction_pending", "A correction of this kind is already waiting")
        if body.claim_kind == "check_out" and (
            (state.check_in_at is not None and claimed <= state.check_in_at)
            or (state.check_in_at is None and not any(e.claim_kind == "check_in" for e in events))
        ):
            raise conflict("correction_order", "Check-out must come after check-in")
        _add(
            session,
            row,
            shift,
            "correction_requested",
            "candidate",
            claimed_at=claimed,
            claim_kind=body.claim_kind,
            note=body.reason.strip(),
        )
        await _flush_events(session, row)
    await audit(session, user.id, "attendance.correction_requested", "booking", row.id)
    for uid in await _team_users(session, row.employer_id):
        await notify(
            session,
            uid,
            "attendance.correction_requested",
            f"Attendance correction requested for {shift.title}",
            None,
            booking_id=str(row.id),
        )
    return await _out(session, row)


@router.post(
    "/employers/{employer_id}/shift-bookings/{booking_id}/attendance-corrections/{event_id}/review",
    response_model=BookingOut,
)
async def review_correction(
    employer_id: uuid.UUID,
    booking_id: uuid.UUID,
    event_id: uuid.UUID,
    body: CorrectionReviewIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, eid=employer_id)
        events = await events_for(session, row.id)
        request = next((e for e in pending_requests(events) if e.id == event_id), None)
        if request is None:
            raise conflict(
                "correction_decided", "That request was already decided or does not exist"
            )
        was_no_show = derive(events, shift.time_zone).status == "no_show"
        _add(
            session,
            row,
            shift,
            f"correction_{body.decision}",
            "employer",
            ref_event_id=request.id,
            note=body.reason.strip(),
        )
        if body.decision == "approved" and request.claim_kind == "check_in" and was_no_show:
            _add(
                session,
                row,
                shift,
                "no_show_reversed",
                "employer",
                note="Check-in correction approved",
            )
        await _flush_events(session, row)
        profile = await session.get(CandidateProfile, row.candidate_id)
    await audit(session, user.id, f"attendance.correction_{body.decision}", "booking", row.id)
    if profile is not None:
        await notify(
            session,
            profile.user_id,
            "attendance.correction_reviewed",
            f"Your attendance correction was {body.decision}",
            body.reason.strip(),
            booking_id=str(row.id),
        )
    return await _out(session, row)


@router.post(
    "/employers/{employer_id}/shift-bookings/{booking_id}/no-show", response_model=BookingOut
)
async def mark_no_show(
    employer_id: uuid.UUID,
    booking_id: uuid.UUID,
    body: ReasonIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, eid=employer_id)
        state = derive(await events_for(session, row.id), shift.time_zone)
        if datetime.now(UTC) < shift.starts_at + NO_SHOW_GRACE:
            raise conflict("too_early", "A no-show can be marked 30 minutes after the shift starts")
        if state.status == "no_show":
            raise conflict("already_no_show", "Already marked")
        if state.check_in_at is not None or state.pending_corrections:
            raise conflict(
                "attendance_recorded", "The worker has checked in or has a correction waiting"
            )
        _add(session, row, shift, "no_show_marked", "employer", note=body.reason.strip())
        await _flush_events(session, row)
        profile = await session.get(CandidateProfile, row.candidate_id)
    await audit(session, user.id, "attendance.no_show_marked", "booking", row.id)
    if profile is not None:
        await notify(
            session,
            profile.user_id,
            "attendance.no_show_marked",
            f"{shift.title} was marked as a no-show",
            "You can request an attendance correction if this is wrong.",
            booking_id=str(row.id),
        )
    return await _out(session, row)


@router.post(
    "/employers/{employer_id}/shift-bookings/{booking_id}/no-show/reverse",
    response_model=BookingOut,
)
async def reverse_no_show(
    employer_id: uuid.UUID,
    booking_id: uuid.UUID,
    body: ReasonIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    async with system_scope(session):
        row, shift = await _locked(session, booking_id, eid=employer_id)
        if derive(await events_for(session, row.id), shift.time_zone).status != "no_show":
            raise conflict("not_no_show", "This booking is not marked as a no-show")
        _add(session, row, shift, "no_show_reversed", "employer", note=body.reason.strip())
        await _flush_events(session, row)
        profile = await session.get(CandidateProfile, row.candidate_id)
    await audit(session, user.id, "attendance.no_show_reversed", "booking", row.id)
    if profile is not None:
        await notify(
            session,
            profile.user_id,
            "attendance.no_show_reversed",
            f"The no-show mark on {shift.title} was removed",
            None,
            booking_id=str(row.id),
        )
    return await _out(session, row)


async def _history(session: AsyncSession, booking: ShiftBooking) -> list[TimesheetVersionOut]:
    rows = await session.scalars(
        select(ShiftTimesheetVersion)
        .where(ShiftTimesheetVersion.booking_id == booking.id)
        .order_by(ShiftTimesheetVersion.recorded_at, ShiftTimesheetVersion.version)
    )
    return [
        TimesheetVersionOut(
            version=v.version,
            status=v.status,
            starts_at=v.starts_at,
            ends_at=v.ends_at,
            break_minutes=v.break_minutes,
            note=v.note,
            review_note=v.review_note,
            recorded_at=v.recorded_at,
            worked_minutes=worked_minutes(v.starts_at, v.ends_at, v.break_minutes),
        )
        for v in rows
    ]


@router.get(
    "/candidate/shift-bookings/{booking_id}/timesheet-history",
    response_model=list[TimesheetVersionOut],
)
async def candidate_history(
    booking_id: uuid.UUID, profile: Candidate, session: Session
) -> list[TimesheetVersionOut]:
    return await _history(session, await _booking(session, booking_id, cid=profile.id))


@router.get(
    "/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-history",
    response_model=list[TimesheetVersionOut],
)
async def employer_history(
    employer_id: uuid.UUID, booking_id: uuid.UUID, _: Viewer, session: Session
) -> list[TimesheetVersionOut]:
    return await _history(session, await _booking(session, booking_id, eid=employer_id))
