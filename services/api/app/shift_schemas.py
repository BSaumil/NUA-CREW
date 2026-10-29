import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas import Orm
from app.services.scheduling import resolve_window, worked_minutes


class ShiftIn(BaseModel):
    job_id: uuid.UUID
    local_date: date
    local_start: time
    local_end: time
    time_zone: str = Field(max_length=64)
    capacity: int = Field(ge=1, le=50)
    hourly_rate_minor: int = Field(ge=1, le=10000000)

    @model_validator(mode="after")
    def valid(self) -> "ShiftIn":
        resolve_window(self.local_date, self.local_start, self.local_end, self.time_zone)
        return self


class ShiftOut(Orm):
    id: uuid.UUID
    job_id: uuid.UUID
    title: str
    starts_at: datetime
    ends_at: datetime
    time_zone: str
    capacity: int
    hourly_rate_minor: int
    super_included: bool
    status: str


class ShiftOfferIn(BaseModel):
    conversation_id: uuid.UUID


class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000, pattern=r"\S")


class BookingActionIn(BaseModel):
    action: Literal["accept", "decline", "cancel"]
    reason: str | None = Field(None, max_length=1000)


class TimesheetIn(BaseModel):
    local_date: date
    local_start: time
    local_end: time
    time_zone: str = Field(max_length=64)
    break_minutes: int = Field(ge=0, le=1439)
    note: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def valid(self) -> "TimesheetIn":
        starts, ends = resolve_window(
            self.local_date, self.local_start, self.local_end, self.time_zone
        )
        worked_minutes(starts, ends, self.break_minutes)
        return self


class TimesheetReviewIn(ReasonIn):
    decision: Literal["approved", "disputed"]
    expected_version: int = Field(ge=1)


class TimesheetOut(Orm):
    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    break_minutes: int
    status: str
    version: int
    note: str | None
    review_note: str | None
    worked_minutes: int


class CorrectionIn(BaseModel):
    """A person says an attendance event happened at a different instant. Needs approval."""

    claim_kind: Literal["check_in", "check_out"]
    claimed_at: datetime
    reason: str = Field(min_length=3, max_length=1000, pattern=r"\S")

    @model_validator(mode="after")
    def aware(self) -> "CorrectionIn":
        if self.claimed_at.tzinfo is None:
            raise ValueError("claimed_at must include a time zone offset")
        return self


class CorrectionReviewIn(ReasonIn):
    decision: Literal["approved", "rejected"]


class AttendanceEventOut(Orm):
    id: uuid.UUID
    kind: str
    actor_role: str
    recorded_at: datetime
    claimed_at: datetime | None
    claim_kind: str | None
    ref_event_id: uuid.UUID | None
    time_zone: str
    note: str | None


class AttendanceOut(BaseModel):
    """Derived state. `venue_time_zone` is for display; instants are the source of truth."""

    status: Literal["not_started", "checked_in", "checked_out", "no_show"]
    check_in_at: datetime | None
    check_out_at: datetime | None
    venue_time_zone: str
    pending_corrections: int
    events: list[AttendanceEventOut]


class TimesheetVersionOut(Orm):
    version: int
    status: str
    starts_at: datetime
    ends_at: datetime
    break_minutes: int
    note: str | None
    review_note: str | None
    recorded_at: datetime
    worked_minutes: int


class BookingOut(BaseModel):
    id: uuid.UUID
    shift: ShiftOut
    candidate_label: str
    status: str
    expires_at: datetime
    reason: str | None
    timesheet: TimesheetOut | None
    attendance: AttendanceOut | None = None
