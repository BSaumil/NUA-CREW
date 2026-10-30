"""Derives attendance state from the append-only event log. Nothing here mutates history."""

from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ShiftAttendanceEvent
from app.shift_schemas import AttendanceEventOut, AttendanceOut

Status = Literal["not_started", "checked_in", "checked_out", "no_show"]


async def events_for(session: AsyncSession, booking_id: object) -> list[ShiftAttendanceEvent]:
    rows = await session.scalars(
        select(ShiftAttendanceEvent)
        .where(ShiftAttendanceEvent.booking_id == booking_id)
        .order_by(ShiftAttendanceEvent.recorded_at, ShiftAttendanceEvent.id)
    )
    return list(rows)


def _effective(events: list[ShiftAttendanceEvent], kind: str) -> datetime | None:
    """The original event's server time, replaced by an approved correction's claimed time."""
    approved = {e.ref_event_id for e in events if e.kind == "correction_approved"}
    claimed = [
        e.claimed_at
        for e in events
        if e.kind == "correction_requested" and e.claim_kind == kind and e.id in approved
    ]
    if claimed and claimed[-1] is not None:
        return claimed[-1]
    original = [e.recorded_at for e in events if e.kind == kind]
    return original[0] if original else None


def pending_requests(events: list[ShiftAttendanceEvent]) -> list[ShiftAttendanceEvent]:
    decided = {
        e.ref_event_id for e in events if e.kind in {"correction_approved", "correction_rejected"}
    }
    return [e for e in events if e.kind == "correction_requested" and e.id not in decided]


def derive(events: list[ShiftAttendanceEvent], venue_time_zone: str) -> AttendanceOut:
    check_in = _effective(events, "check_in")
    check_out = _effective(events, "check_out")
    marks = [e for e in events if e.kind in {"no_show_marked", "no_show_reversed"}]
    no_show = bool(marks) and marks[-1].kind == "no_show_marked"
    status: Status
    if no_show:
        status = "no_show"
    elif check_out is not None:
        status = "checked_out"
    elif check_in is not None:
        status = "checked_in"
    else:
        status = "not_started"
    return AttendanceOut(
        status=status,
        check_in_at=check_in,
        check_out_at=check_out,
        venue_time_zone=venue_time_zone,
        pending_corrections=len(pending_requests(events)),
        events=[AttendanceEventOut.model_validate(e) for e in events],
    )
