"""Request/response schemas for the hospitality taxonomy and pay assessment."""

import uuid
from datetime import date, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas import Orm

Instrument = Literal[
    "MA000119", "MA000009", "MA000003", "MA000058", "enterprise_agreement", "award_free", "unknown"
]
AwardCode = Literal["MA000119", "MA000009", "MA000003", "MA000058"]
Status = Literal["compliant_as_assessed", "below_minimum", "requires_review", "missing_source"]
Level = Literal["info", "warn", "block"]
DayKind = Literal["weekday", "saturday", "sunday", "public_holiday"]


# ---- taxonomy -------------------------------------------------------------------------------
class DepartmentOut(Orm):
    code: str
    name: str
    workstream: str
    sort_order: int
    role_count: int = 0


class RoleOut(Orm):
    code: str
    title: str
    department_code: str
    department_name: str
    tier: int
    workstream: str
    indicative_text: str
    indicative_level_min: int | None
    indicative_level_max: int | None
    needs_review: bool
    duties_based: bool
    apprentice: bool
    introductory: bool
    scope_text: str
    compliance_note: str
    source_url: str
    aliases: list[str] = []
    matched_alias: str | None = None


class VenueTypeOut(Orm):
    code: str
    name: str
    award_leads: list[str]
    coverage_confidence: str


class ClassificationOut(BaseModel):
    code: str
    label: str
    description: str
    kind: str
    hourly_minor: int | None
    weekly_minor: int | None
    annual_minimum_minor: int | None
    effective_from: date | None
    data_status: str | None
    source_url: str | None


class InstrumentOut(BaseModel):
    code: str
    title: str
    source_url: str
    classifications: list[ClassificationOut]


# ---- assessment -----------------------------------------------------------------------------
class RosterShiftIn(BaseModel):
    local_date: date
    local_start: time
    local_end: time  # at or before the start means the shift finishes on the next day
    break_minutes: int = Field(0, ge=0, le=600)


class PayAssessmentIn(BaseModel):
    employer_venue_type: str | None = Field(None, max_length=24)
    state: Literal["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"]
    role_code: str | None = Field(None, max_length=12)
    instrument: Instrument
    coverage_confirmed: bool = False
    classification: str | None = Field(None, max_length=12)
    classification_confirmed: bool = False
    employment: Literal["full_time", "part_time", "casual"]
    worker_class: Literal["adult", "junior", "apprentice", "trainee"] = "adult"
    pay_period: Literal["hour", "day", "week", "month", "year"]
    pay_amount: Decimal = Field(gt=0, le=10_000_000, decimal_places=2)
    pay_includes_super: bool = False
    rate_structure: Literal["base_plus_penalties", "flat_all_hours"] = "base_plus_penalties"
    effective_on: date | None = None
    roster: list[RosterShiftIn] = Field(default=[], max_length=14)
    job_id: uuid.UUID | None = None

    @field_validator("pay_amount")
    @classmethod
    def _cents(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def _coverage(self) -> "PayAssessmentIn":
        return self


class CheckOut(BaseModel):
    code: str
    level: Level
    text: str


class RosterSegmentOut(BaseModel):
    local_date: date
    day_kind: DayKind
    minutes: int
    award_minimum_minor: int | None  # what the award requires for this segment
    estimated_pay_minor: int | None  # what the advertised rate implies for this segment
    status: Status


class RosterShiftOut(BaseModel):
    local_date: date
    starts_at: str
    ends_at: str
    time_zone: str
    paid_minutes: int
    segments: list[RosterSegmentOut]


class RateSourceOut(BaseModel):
    instrument: str
    classification: str
    rate_version_id: uuid.UUID
    effective_from: date
    hourly_minor: int
    weekly_minor: int
    data_status: str
    source_url: str


class SuperOut(BaseModel):
    rate_bp: int
    per_hour_minor: int | None
    roster_total_minor: int | None
    note: str


class PayAssessmentResult(BaseModel):
    status: Status
    blocking: bool
    summary: str
    instrument: str
    classification: str | None
    classification_label: str | None
    employment: str
    offered_hourly_minor: int | None
    minimum_ordinary_hourly_minor: int | None
    minimum_weekday_basis: str | None
    weekend_and_holiday_minimums: dict[str, int | None]
    checks: list[CheckOut]
    shifts: list[RosterShiftOut]
    sources: list[RateSourceOut]
    super: SuperOut | None
    not_assessed: list[str]
    data_status: str  # supplied_unverified until an administrator verifies the rate versions
    needs_acknowledgement: bool


class PayAssessmentOut(BaseModel):
    id: uuid.UUID
    employer_id: uuid.UUID
    job_id: uuid.UUID | None
    effective_on: date
    created_at: str
    acknowledged: bool
    input: dict[str, object]
    result: PayAssessmentResult


class AcknowledgeIn(BaseModel):
    note: str | None = Field(None, max_length=1000)


class CoverageSuggestionOut(BaseModel):
    instrument: str
    title: str
    confidence: str
    reason: str
    classification_leads: list[str]


class CoverageGuidanceOut(BaseModel):
    role_code: str | None
    venue_type: str | None
    suggestions: list[CoverageSuggestionOut]
    questions: list[str]
    note: str
