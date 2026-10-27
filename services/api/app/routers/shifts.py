"""Explicit shift offers and acceptance; invitations alone never reserve a worker."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.deps import Candidate, CurrentUser, Recruiter, Session, Viewer
from app.errors import conflict, forbidden, not_found
from app.models import (
    CandidateProfile,
    Commitment,
    Conversation,
    Employer,
    Invitation,
    Job,
    Shift,
    ShiftBooking,
    ShiftTimesheet,
)
from app.rls import system_scope
from app.routers.availability import _flush_commitment
from app.services.jobs import is_open
from app.services.scheduling import resolve_window, worked_minutes
from app.shift_schemas import (
    BookingActionIn,
    BookingOut,
    ReasonIn,
    ShiftIn,
    ShiftOfferIn,
    ShiftOut,
    TimesheetIn,
    TimesheetOut,
    TimesheetReviewIn,
)

router = APIRouter(prefix="/v1", tags=["shifts"])


async def _shift(session: AsyncSession, sid: uuid.UUID, eid: uuid.UUID | None = None) -> Shift:
    stmt = select(Shift).where(Shift.id == sid)
    if eid is not None:
        stmt = stmt.where(Shift.employer_id == eid)
    row = await session.scalar(stmt)
    if row is None:
        raise not_found("shift")
    return row


async def _booking(
    session: AsyncSession,
    bid: uuid.UUID,
    *,
    eid: uuid.UUID | None = None,
    cid: uuid.UUID | None = None,
) -> ShiftBooking:
    stmt = select(ShiftBooking).where(ShiftBooking.id == bid)
    if eid is not None:
        stmt = stmt.where(ShiftBooking.employer_id == eid)
    if cid is not None:
        stmt = stmt.where(ShiftBooking.candidate_id == cid)
    row = await session.scalar(stmt)
    if row is None:
        raise not_found("booking")
    return row


async def _out(session: AsyncSession, row: ShiftBooking) -> BookingOut:
    shift = await _shift(session, row.shift_id)
    sheet = await session.scalar(select(ShiftTimesheet).where(ShiftTimesheet.booking_id == row.id))
    sheet_out = None
    if sheet:
        sheet_out = TimesheetOut(
            **{
                name: getattr(sheet, name)
                for name in (
                    "id",
                    "starts_at",
                    "ends_at",
                    "break_minutes",
                    "status",
                    "version",
                    "note",
                    "review_note",
                )
            },
            worked_minutes=worked_minutes(sheet.starts_at, sheet.ends_at, sheet.break_minutes),
        )
    return BookingOut(
        id=row.id,
        shift=ShiftOut.model_validate(shift),
        candidate_label=row.candidate_label,
        status="expired"
        if row.status == "offered" and row.expires_at <= datetime.now(UTC)
        else row.status,
        expires_at=row.expires_at,
        reason=row.reason,
        timesheet=sheet_out,
    )


async def _lock_shift(session: AsyncSession, sid: uuid.UUID) -> None:
    await session.execute(select(Shift.id).where(Shift.id == sid).with_for_update())


@router.post("/employers/{employer_id}/shifts", response_model=ShiftOut, status_code=201)
async def create_shift(
    employer_id: uuid.UUID, body: ShiftIn, _: Recruiter, user: CurrentUser, session: Session
) -> Shift:
    employer = await session.get(Employer, employer_id)
    job = await session.scalar(
        select(Job).where(Job.id == body.job_id, Job.employer_id == employer_id)
    )
    if employer is None or job is None:
        raise not_found("job")
    if employer.verification_status != "verified":
        raise forbidden("Business verification is required")
    if not is_open(job) or job.pay_period != "hour" or job.super_included is None:
        raise conflict(
            "shift_job_unavailable", "Use an open job with hourly pay and explicit super disclosure"
        )
    if (
        job.pay_min is None
        or job.pay_max is None
        or not job.pay_min * 100 <= body.hourly_rate_minor <= job.pay_max * 100
    ):
        raise conflict("shift_rate", "Choose a rate within the advertised hourly range")
    starts, ends = resolve_window(body.local_date, body.local_start, body.local_end, body.time_zone)
    if starts <= datetime.now(UTC):
        raise conflict("shift_started", "Choose a future shift")
    row = Shift(
        employer_id=employer_id,
        job_id=job.id,
        title=job.title,
        starts_at=starts,
        ends_at=ends,
        time_zone=body.time_zone,
        capacity=body.capacity,
        hourly_rate_minor=body.hourly_rate_minor,
        super_included=job.super_included,
        status="open",
    )
    async with system_scope(session):
        session.add(row)
    await audit(session, user.id, "shift.created", "shift", row.id)
    return row


@router.get("/employers/{employer_id}/shifts", response_model=list[ShiftOut])
async def list_shifts(employer_id: uuid.UUID, _: Viewer, session: Session) -> list[Shift]:
    return list(
        await session.scalars(
            select(Shift)
            .where(Shift.employer_id == employer_id)
            .order_by(Shift.starts_at.desc())
            .limit(100)
        )
    )


@router.post(
    "/employers/{employer_id}/shifts/{shift_id}/offers", response_model=BookingOut, status_code=201
)
async def offer(
    employer_id: uuid.UUID,
    shift_id: uuid.UUID,
    body: ShiftOfferIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    shift = await _shift(session, shift_id, employer_id)
    await _lock_shift(session, shift.id)
    await session.refresh(shift)
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.id == body.conversation_id,
            Conversation.employer_id == employer_id,
            Conversation.job_id == shift.job_id,
            Conversation.status == "open",
            Conversation.employer_access,
        )
    )
    employer = await session.get(Employer, employer_id)
    job = await session.get(Job, shift.job_id)
    if conversation is None:
        raise not_found("conversation")
    invitation = await session.get(Invitation, conversation.invitation_id)
    if invitation is None or invitation.kind != "temporary":
        raise conflict(
            "temporary_conversation_required", "Use an accepted temporary-work invitation"
        )
    if (
        employer is None
        or employer.verification_status != "verified"
        or job is None
        or not is_open(job)
    ):
        raise forbidden("The business and job must remain available")
    if shift.status != "open" or shift.starts_at <= datetime.now(UTC):
        raise conflict("shift_unavailable", "This shift is no longer available")
    existing = await session.scalar(
        select(ShiftBooking).where(
            ShiftBooking.shift_id == shift.id,
            ShiftBooking.candidate_id == conversation.candidate_id,
        )
    )
    if existing:
        return await _out(session, existing)
    row = ShiftBooking(
        shift_id=shift.id,
        employer_id=employer_id,
        candidate_id=conversation.candidate_id,
        conversation_id=conversation.id,
        candidate_label=invitation.snapshot.get("candidate_label", "Candidate"),
        status="offered",
        expires_at=min(shift.starts_at, datetime.now(UTC) + timedelta(days=2)),
    )
    async with system_scope(session):
        session.add(row)
    await audit(session, user.id, "shift.offered", "booking", row.id)
    return await _out(session, row)


@router.get("/employers/{employer_id}/shift-bookings", response_model=list[BookingOut])
async def employer_bookings(
    employer_id: uuid.UUID, _: Viewer, session: Session
) -> list[BookingOut]:
    rows = await session.scalars(
        select(ShiftBooking)
        .where(ShiftBooking.employer_id == employer_id)
        .order_by(ShiftBooking.created_at.desc())
        .limit(100)
    )
    return [await _out(session, row) for row in rows]


@router.get("/candidate/shift-bookings", response_model=list[BookingOut])
async def candidate_bookings(profile: Candidate, session: Session) -> list[BookingOut]:
    rows = await session.scalars(
        select(ShiftBooking)
        .where(ShiftBooking.candidate_id == profile.id)
        .order_by(ShiftBooking.created_at.desc())
        .limit(100)
    )
    return [await _out(session, row) for row in rows]


async def _cancel(session: AsyncSession, booking: ShiftBooking, reason: str) -> None:
    if booking.status in {"cancelled", "declined"}:
        return
    if booking.commitment_id:
        commitment = await session.get(Commitment, booking.commitment_id)
        booking.commitment_id = None
        await session.flush()
        if commitment:
            await session.delete(commitment)
    booking.status = "cancelled"
    booking.reason = reason


@router.post("/candidate/shift-bookings/{booking_id}/respond", response_model=BookingOut)
async def respond(
    booking_id: uuid.UUID,
    body: BookingActionIn,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    row = await _booking(session, booking_id, cid=profile.id)
    # Global lock order: candidate, shift, booking. Different shifts for one person cannot race.
    await session.execute(
        select(CandidateProfile.id).where(CandidateProfile.id == profile.id).with_for_update()
    )
    async with system_scope(session):
        await _lock_shift(session, row.shift_id)
        await session.refresh(row, with_for_update=True)
        shift = await _shift(session, row.shift_id)
        now = datetime.now(UTC)
        if body.action == "accept" and row.status == "confirmed":
            return await _out(session, row)
        if body.action == "cancel":
            if not body.reason or len(body.reason.strip()) < 3:
                raise conflict("reason_required", "Explain the cancellation")
            if shift.starts_at <= now:
                raise conflict(
                    "shift_started", "Contact the business or support about work already started"
                )
            await _cancel(session, row, body.reason.strip())
        elif row.status != "offered" or row.expires_at <= now or shift.status != "open":
            raise conflict("offer_unavailable", "This offer is no longer available")
        elif body.action == "decline":
            row.status = "declined"
        else:
            employer = await session.get(Employer, row.employer_id)
            conversation = await session.get(Conversation, row.conversation_id)
            job = await session.get(Job, shift.job_id)
            if (
                employer is None
                or employer.verification_status != "verified"
                or conversation is None
                or conversation.status != "open"
                or not conversation.employer_access
                or job is None
                or not is_open(job)
            ):
                raise conflict(
                    "offer_unavailable", "The business, conversation or job is no longer available"
                )
            count = await session.scalar(
                select(func.count())
                .select_from(ShiftBooking)
                .where(ShiftBooking.shift_id == shift.id, ShiftBooking.status == "confirmed")
            )
            if (count or 0) >= shift.capacity:
                raise conflict("shift_full", "All places on this shift have been accepted")
            clash = await session.scalar(
                select(Commitment.id)
                .where(
                    Commitment.candidate_id == profile.id,
                    Commitment.status == "confirmed",
                    Commitment.starts_at < shift.ends_at,
                    Commitment.ends_at > shift.starts_at,
                )
                .limit(1)
            )
            if clash:
                raise conflict(
                    "commitment_conflict", "That overlaps work you have already confirmed"
                )
            commitment = Commitment(
                candidate_id=profile.id,
                starts_at=shift.starts_at,
                ends_at=shift.ends_at,
                status="confirmed",
                source="shift",
                label=shift.title,
                venue_time_zone=shift.time_zone,
            )
            session.add(commitment)
            await _flush_commitment(session)
            row.commitment_id = commitment.id
            row.status = "confirmed"
    await audit(session, user.id, f"shift.{body.action}", "booking", row.id)
    return await _out(session, row)


@router.post("/employers/{employer_id}/shifts/{shift_id}/cancel", response_model=ShiftOut)
async def cancel_shift(
    employer_id: uuid.UUID,
    shift_id: uuid.UUID,
    body: ReasonIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> Shift:
    shift = await _shift(session, shift_id, employer_id)
    async with system_scope(session):
        await _lock_shift(session, shift.id)
        await session.refresh(shift)
        if shift.starts_at <= datetime.now(UTC):
            raise conflict(
                "shift_started", "Use support or timesheet review for work already started"
            )
        shift.status = "cancelled"
        rows = await session.scalars(select(ShiftBooking).where(ShiftBooking.shift_id == shift.id))
        for row in rows:
            await _cancel(session, row, body.reason.strip())
    await audit(session, user.id, "shift.cancelled", "shift", shift.id, reason=body.reason)
    return shift


@router.put("/candidate/shift-bookings/{booking_id}/timesheet", response_model=BookingOut)
async def submit_timesheet(
    booking_id: uuid.UUID,
    body: TimesheetIn,
    profile: Candidate,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    row = await _booking(session, booking_id, cid=profile.id)
    starts, ends = resolve_window(body.local_date, body.local_start, body.local_end, body.time_zone)
    async with system_scope(session):
        await session.refresh(row, with_for_update=True)
        shift = await _shift(session, row.shift_id)
        if (
            row.status != "confirmed"
            or shift.ends_at > datetime.now(UTC)
            or ends > datetime.now(UTC)
        ):
            raise conflict(
                "timesheet_unavailable",
                "Submit actual hours after the confirmed shift has finished",
            )
        if starts < shift.starts_at - timedelta(hours=12) or ends > shift.ends_at + timedelta(
            hours=12
        ):
            raise conflict("timesheet_window", "Hours far outside this shift need support review")
        sheet = await session.scalar(
            select(ShiftTimesheet).where(ShiftTimesheet.booking_id == row.id)
        )
        if sheet and sheet.status == "approved":
            raise conflict("timesheet_approved", "Approved hours need support review to amend")
        if sheet is None:
            sheet = ShiftTimesheet(booking_id=row.id, version=0)
            session.add(sheet)
        sheet.starts_at, sheet.ends_at = starts, ends
        sheet.break_minutes, sheet.note = body.break_minutes, body.note
        sheet.status, sheet.review_note, sheet.version = "submitted", None, sheet.version + 1
    await audit(session, user.id, "timesheet.submitted", "booking", row.id, version=sheet.version)
    return await _out(session, row)


@router.post(
    "/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-review",
    response_model=BookingOut,
)
async def review_timesheet(
    employer_id: uuid.UUID,
    booking_id: uuid.UUID,
    body: TimesheetReviewIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> BookingOut:
    row = await _booking(session, booking_id, eid=employer_id)
    async with system_scope(session):
        await session.refresh(row, with_for_update=True)
        sheet = await session.scalar(
            select(ShiftTimesheet).where(ShiftTimesheet.booking_id == row.id)
        )
        if sheet is None:
            raise not_found("timesheet")
        if sheet.status != "submitted" or sheet.version != body.expected_version:
            raise conflict(
                "timesheet_changed", "Reload the latest submitted hours before reviewing"
            )
        sheet.status, sheet.review_note = body.decision, body.reason.strip()
    await audit(
        session, user.id, f"timesheet.{body.decision}", "booking", row.id, version=sheet.version
    )
    return await _out(session, row)
