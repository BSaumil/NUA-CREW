import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

from app.abn import is_valid_abn_checksum, normalise_abn

EmploymentType = Literal["full_time", "part_time", "casual", "contract", "shift"]
PayPeriod = Literal["hour", "day", "week", "month", "year"]
Password = Annotated[str, StringConstraints(min_length=12, max_length=128)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
State = Literal["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]
Postcode = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]


class Orm(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth ----
class LocationIn(BaseModel):
    name: Name
    suburb: Name
    state: State
    postcode: Postcode


class CandidateRegister(BaseModel):
    email: EmailStr
    password: Password
    full_name: Name
    accept_terms: Literal[True]


class EmployerRegister(BaseModel):
    email: EmailStr
    password: Password
    full_name: Name
    organisation_name: Name
    abn: str | None = None
    location: LocationIn | None = None
    accept_terms: Literal[True]

    @model_validator(mode="after")
    def _abn(self) -> "EmployerRegister":
        if self.abn is not None:
            self.abn = normalise_abn(self.abn)
            if not is_valid_abn_checksum(self.abn):
                raise ValueError("ABN failed checksum validation")
        return self


class Login(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    role: str
    user_id: uuid.UUID


class MembershipOut(Orm):
    employer_id: uuid.UUID
    role: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    memberships: list[MembershipOut] = []


# ---- candidate ----
class ProfileIn(BaseModel):
    full_name: Name
    headline: str | None = Field(None, max_length=200)
    summary: str | None = Field(None, max_length=5000)
    suburb: str | None = Field(None, max_length=100)
    state: State | None = None
    postcode: Postcode | None = None
    preferred_employment_types: list[EmploymentType] = []
    min_hourly_pay: Decimal | None = Field(None, ge=0, le=1000)
    max_commute_km: int | None = Field(None, gt=0, le=500)
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(
        default=[], max_length=50
    )


class ProfileOut(Orm):
    id: uuid.UUID
    full_name: str
    headline: str | None
    summary: str | None
    suburb: str | None
    state: str | None
    postcode: str | None
    preferred_employment_types: list[str]
    min_hourly_pay: Decimal | None
    max_commute_km: int | None
    discoverable: bool
    skills: list[str] = []


class ConsentIn(BaseModel):
    granted: bool


class ResumeIn(BaseModel):
    title: Name
    content_text: Annotated[str, StringConstraints(min_length=1, max_length=50000)]


class ResumeVersionIn(BaseModel):
    content_text: Annotated[str, StringConstraints(min_length=1, max_length=50000)]


class ResumeVersionOut(Orm):
    id: uuid.UUID
    version: int
    content_text: str
    created_at: datetime


class ResumeOut(Orm):
    id: uuid.UUID
    title: str
    versions: list[ResumeVersionOut]


# ---- employer / jobs ----
class EmployerOut(Orm):
    id: uuid.UUID
    name: str
    abn: str | None
    verification_status: str


class LocationOut(Orm):
    id: uuid.UUID
    name: str
    suburb: str
    state: str
    postcode: str


class MemberIn(BaseModel):
    email: EmailStr
    role: Literal["recruiter", "viewer"]


class MemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    role: str


class JobIn(BaseModel):
    title: Name
    description: Annotated[str, StringConstraints(min_length=1, max_length=20000)]
    employment_type: EmploymentType
    category: str | None = Field(None, max_length=100)
    location_id: uuid.UUID | None = None
    pay_min: Decimal | None = Field(None, ge=0)
    pay_max: Decimal | None = Field(None, ge=0)
    pay_period: PayPeriod | None = None
    super_included: bool | None = None
    expires_at: datetime | None = None
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(
        default=[], max_length=30
    )

    @model_validator(mode="after")
    def _pay(self) -> "JobIn":
        has_pay = self.pay_min is not None or self.pay_max is not None
        if has_pay and self.pay_period is None:
            raise ValueError("pay_period is required when pay is disclosed")
        if self.pay_min is not None and self.pay_max is not None and self.pay_min > self.pay_max:
            raise ValueError("pay_min must not exceed pay_max")
        return self


class JobPatch(BaseModel):
    """Full replacement of editable fields (PUT semantics keep pay invariants simple)."""

    job: JobIn


class JobEmployerOut(BaseModel):
    id: uuid.UUID | None
    name: str | None
    verification_status: str | None


class JobOut(BaseModel):
    id: uuid.UUID
    origin: str
    title: str
    description: str
    status: str
    employment_type: str
    category: str | None
    suburb: str | None
    state: str | None
    postcode: str | None
    pay_min: Decimal | None
    pay_max: Decimal | None
    pay_period: str | None
    pay_currency: str
    super_included: bool | None
    pay_basis: str
    apply_url: str | None
    attribution: str | None
    published_at: datetime | None
    expires_at: datetime | None
    last_verified_at: datetime | None
    skills: list[str]
    employer: JobEmployerOut
    location_id: uuid.UUID | None = None


class JobList(BaseModel):
    items: list[JobOut]
    total: int
    page: int
    page_size: int


# ---- matching ----
class MatchComponent(BaseModel):
    key: str
    weight: int
    evaluated: bool
    score: float | None
    evidence: str
    basis: Literal["verified", "self_declared", "inferred", "not_evaluated"]


class MatchOut(BaseModel):
    job_id: uuid.UUID
    estimate: float | None
    label: str = "Estimated match — not a prediction of being hired"
    gates: list[dict[str, object]]
    components: list[MatchComponent]
    missing_skills: list[str]


# ---- applications ----
class ApplyIn(BaseModel):
    resume_id: uuid.UUID | None = None
    cover_note: str | None = Field(None, max_length=5000)


class StatusChangeIn(BaseModel):
    to_status: Literal["under_review", "shortlisted", "interview", "offer", "hired", "rejected"]
    note: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _reason(self) -> "StatusChangeIn":
        if self.to_status == "rejected" and not (self.note and self.note.strip()):
            raise ValueError("A reason is required to reject an application (human decision)")
        return self


class NoteIn(BaseModel):
    note: Annotated[str, StringConstraints(min_length=1, max_length=2000)]


class EventOut(Orm):
    id: uuid.UUID
    event_type: str
    from_status: str | None
    to_status: str | None
    actor_role: str
    note: str | None
    created_at: datetime


class ApplicationJobOut(BaseModel):
    id: uuid.UUID
    title: str
    employer_name: str | None
    suburb: str | None
    status: str


class CandidateApplicationOut(BaseModel):
    id: uuid.UUID
    status: str
    cover_note: str | None
    created_at: datetime
    updated_at: datetime
    job: ApplicationJobOut
    events: list[EventOut] = []


class ApplicantOut(BaseModel):
    application_id: uuid.UUID
    status: str
    created_at: datetime
    full_name: str
    headline: str | None
    suburb: str | None
    skills: list[str]


class EmployerApplicationOut(ApplicantOut):
    job_id: uuid.UUID
    job_title: str
    summary: str | None
    cover_note: str | None
    resume_text: str | None
    events: list[EventOut]


class NotificationOut(Orm):
    id: uuid.UUID
    kind: str
    title: str
    body: str | None
    data: dict[str, object]
    read_at: datetime | None
    created_at: datetime


# ---- admin / ingestion ----
class VerifyEmployerIn(BaseModel):
    status: Literal["pending", "verified", "rejected"]
    evidence: str = Field(min_length=1, max_length=2000)


class SourceIn(BaseModel):
    slug: Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{3,100}$")]
    name: Name
    kind: Literal["fixture", "ats_feed"]
    config: dict[str, object] = {}


class SourceOut(Orm):
    id: uuid.UUID
    slug: str
    name: str
    kind: str
    status: str


class PermissionIn(BaseModel):
    legal_basis: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    license: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    attribution: str | None = None
    permitted_fields: list[str] = Field(min_length=1)
    valid_until: datetime | None = None


class FetchRunOut(Orm):
    id: uuid.UUID
    status: str
    stats: dict[str, object]
    error: str | None


class ScheduleIn(BaseModel):
    interval_seconds: int | None = Field(None, ge=60, le=7 * 24 * 3600)
    min_interval_seconds: int = Field(60, ge=0, le=24 * 3600)


class TaskOut(Orm):
    id: uuid.UUID
    source_id: uuid.UUID
    status: str
    attempts: int
    max_attempts: int
    run_after: datetime
    last_error: str | None
    result: dict[str, object] | None
    created_at: datetime
    finished_at: datetime | None


class SourceHealthOut(Orm):
    id: uuid.UUID
    slug: str
    status: str
    schedule_interval_seconds: int | None
    min_interval_seconds: int
    next_run_at: datetime | None
    consecutive_failures: int
    circuit_open_until: datetime | None
    last_success_at: datetime | None


class IngestionStatsOut(BaseModel):
    tasks: dict[str, int]
    sources: list[SourceHealthOut]
