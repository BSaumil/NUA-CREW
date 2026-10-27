import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

from app.abn import is_valid_abn_checksum, normalise_abn
from app.services.availability import local_interval, zone

EmploymentType = Literal["full_time", "part_time", "casual", "contract", "shift"]
PayPeriod = Literal["hour", "day", "week", "month", "year"]
EngagementBasis = Literal["employee", "contractor", "unspecified"]
DurationType = Literal["ongoing", "fixed_term", "one_off", "unspecified"]
HoursPatternJob = Literal["full_time", "part_time", "casual", "unspecified"]
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


Client = Literal["web", "mobile"]


class CandidateRegister(BaseModel):
    email: EmailStr
    password: Password
    full_name: Name
    accept_terms: Literal[True]
    client: Client = "web"  # mobile clients receive a refresh token
    device_label: str | None = Field(None, max_length=100)


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
    client: Client = "web"
    device_label: str | None = Field(None, max_length=100)


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    role: str
    user_id: uuid.UUID
    expires_in: int = 1800
    refresh_token: str | None = None


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


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
    push_enabled: bool = True
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
    # Employment basis, duration and schedule are separate facts; employment_type stays for
    # compatibility. "unspecified" is a valid, honest answer.
    engagement_basis: EngagementBasis = "unspecified"
    duration_type: DurationType = "unspecified"
    hours_pattern: HoursPatternJob = "unspecified"
    min_weekly_hours: Decimal | None = Field(None, ge=0, le=168)
    max_weekly_hours: Decimal | None = Field(None, ge=0, le=168)
    start_date: date | None = None
    end_date: date | None = None
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(
        default=[], max_length=30
    )

    @model_validator(mode="after")
    def _facets(self) -> "JobIn":
        if (
            self.min_weekly_hours is not None
            and self.max_weekly_hours is not None
            and self.min_weekly_hours > self.max_weekly_hours
        ):
            raise ValueError("min_weekly_hours must not exceed max_weekly_hours")
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must not be after end_date")
        return self

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
    engagement_basis: str = "unspecified"
    duration_type: str = "unspecified"
    hours_pattern: str = "unspecified"
    min_weekly_hours: Decimal | None = None
    max_weekly_hours: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
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
    distance_km: float | None = None  # straight-line, approximate; only for near-me searches


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


# ---- mobile: saved jobs/searches, devices, account ----
class SearchParamsIn(BaseModel):
    """The subset of search filters that can be saved (and alerted on)."""

    q: str | None = Field(None, max_length=200)
    suburb: str | None = Field(None, max_length=100)
    state: State | None = None
    employment_type: EmploymentType | None = None
    category: str | None = Field(None, max_length=100)
    skill: str | None = Field(None, max_length=100)
    min_hourly: float | None = Field(None, ge=0, le=1000)
    near_lat: float | None = Field(None, ge=-90, le=90)
    near_lng: float | None = Field(None, ge=-180, le=180)
    radius_km: float | None = Field(None, gt=0, le=200)
    posted_within_days: int | None = Field(None, ge=1, le=90)

    @model_validator(mode="after")
    def _near(self) -> "SearchParamsIn":
        if (self.near_lat is None) != (self.near_lng is None):
            raise ValueError("near_lat and near_lng go together")
        return self


class SavedSearchIn(BaseModel):
    name: Name
    params: SearchParamsIn
    alerts_enabled: bool = True


class SavedSearchPatch(BaseModel):
    name: Name | None = None
    alerts_enabled: bool | None = None


class SavedSearchOut(BaseModel):
    id: uuid.UUID
    name: str
    params: dict[str, object]
    alerts_enabled: bool
    last_alerted_at: datetime | None
    created_at: datetime


class SavedJobOut(BaseModel):
    job: JobOut
    saved_at: datetime
    is_open: bool


class DeviceIn(BaseModel):
    token: Annotated[str, StringConstraints(min_length=10, max_length=300)]
    platform: Literal["ios", "android"]


class NotificationSettingsIn(BaseModel):
    push_enabled: bool


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: Password


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=128)


# ---- work preferences, availability, employer preferences (candidate-private) ----
WorkKind = Literal["permanent", "temporary"]
EngagementPref = Literal["employee", "contractor"]
HoursPref = Literal["full_time", "part_time", "casual"]


class WorkPreferenceIn(BaseModel):
    """Preferences about an arrangement. Not proof of status: ticking contractor is not an ABN
    check, and it does not make anyone a contractor in law."""

    enabled: bool
    engagement_bases: list[EngagementPref] = Field(default=[], max_length=2)
    hours_patterns: list[HoursPref] = Field(default=[], max_length=3)
    min_weekly_hours: Decimal | None = Field(None, ge=0, le=168)
    max_weekly_hours: Decimal | None = Field(None, ge=0, le=168)
    min_hourly_pay: Decimal | None = Field(None, ge=0, le=1000)
    max_travel_km: int | None = Field(None, gt=0, le=500)
    notice_period_days: int | None = Field(None, ge=0, le=365)
    available_from: date | None = None

    @model_validator(mode="after")
    def _ok(self) -> "WorkPreferenceIn":
        if (
            self.min_weekly_hours is not None
            and self.max_weekly_hours is not None
            and self.min_weekly_hours > self.max_weekly_hours
        ):
            raise ValueError("min_weekly_hours must not exceed max_weekly_hours")
        self.engagement_bases = sorted(set(self.engagement_bases))
        self.hours_patterns = sorted(set(self.hours_patterns))
        return self


class WorkPreferenceOut(Orm):
    kind: str
    enabled: bool
    discoverable: bool
    engagement_bases: list[str]
    hours_patterns: list[str]
    min_weekly_hours: Decimal | None
    max_weekly_hours: Decimal | None
    min_hourly_pay: Decimal | None
    max_travel_km: int | None
    notice_period_days: int | None
    available_from: date | None


class WorkPreferencesOut(BaseModel):
    """None means the person has never set that kind (distinct from set-but-off)."""

    permanent: WorkPreferenceOut | None
    temporary: WorkPreferenceOut | None


def _minute_precision(t: time) -> time:
    if t.second or t.microsecond:
        raise ValueError("times must be whole minutes")
    return t.replace(tzinfo=None)


class AvailabilityRuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6, description="Monday = 0")
    start_time: time
    end_time: time = Field(description="At or before start_time means the window ends next day")

    @model_validator(mode="after")
    def _ok(self) -> "AvailabilityRuleIn":
        self.start_time = _minute_precision(self.start_time)
        self.end_time = _minute_precision(self.end_time)
        if self.start_time == self.end_time:
            raise ValueError("start_time and end_time must differ")
        return self


class AvailabilityRuleOut(Orm):
    id: uuid.UUID
    weekday: int
    start_time: time
    end_time: time


class AvailabilityRulesIn(BaseModel):
    time_zone: str = Field(max_length=64)
    rules: list[AvailabilityRuleIn] = Field(max_length=70)

    @model_validator(mode="after")
    def _ok(self) -> "AvailabilityRulesIn":
        zone(self.time_zone)  # raises ValueError for an unknown IANA zone
        return self


class AvailabilityExceptionIn(BaseModel):
    state: Literal["available", "unavailable"]
    start_date: date
    end_date: date
    start_time: time | None = None
    end_time: time | None = None

    @model_validator(mode="after")
    def _ok(self) -> "AvailabilityExceptionIn":
        if self.start_date > self.end_date:
            raise ValueError("start_date must not be after end_date")
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("provide both start_time and end_time, or neither for all day")
        if self.start_time is not None and self.end_time is not None:
            self.start_time = _minute_precision(self.start_time)
            self.end_time = _minute_precision(self.end_time)
            if self.start_time == self.end_time:
                raise ValueError("start_time and end_time must differ")
        if (self.end_date - self.start_date).days > 366:
            raise ValueError("an exception can cover at most a year")
        return self


class AvailabilityExceptionOut(Orm):
    id: uuid.UUID
    state: str
    start_date: date
    end_date: date
    start_time: time | None
    end_time: time | None


class CommitmentIn(BaseModel):
    """Either absolute instants (starts_at/ends_at with a UTC offset) or the person's own local
    date and times (local_date/local_start/local_end, read in their time zone; an end at or before
    the start runs overnight). Phones send the local form so they never do time-zone arithmetic."""

    starts_at: datetime | None = None
    ends_at: datetime | None = None
    local_date: date | None = None
    local_start: time | None = None
    local_end: time | None = None
    status: Literal["held", "confirmed"] = "confirmed"
    label: str | None = Field(None, max_length=100)
    venue_time_zone: str | None = Field(None, max_length=64)

    @model_validator(mode="after")
    def _ok(self) -> "CommitmentIn":
        instants = self.starts_at is not None or self.ends_at is not None
        local = (
            self.local_date is not None
            or self.local_start is not None
            or self.local_end is not None
        )
        if instants == local:
            raise ValueError("provide starts_at and ends_at, or local_date with local_start/end")
        if instants:
            if self.starts_at is None or self.ends_at is None:
                raise ValueError("provide both starts_at and ends_at")
            if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
                raise ValueError("starts_at and ends_at must include a UTC offset")
            if self.ends_at <= self.starts_at:
                raise ValueError("ends_at must be after starts_at")
        else:
            if self.local_date is None or self.local_start is None or self.local_end is None:
                raise ValueError("provide local_date, local_start and local_end")
            self.local_start = _minute_precision(self.local_start)
            self.local_end = _minute_precision(self.local_end)
            if self.local_start == self.local_end:
                raise ValueError("local_start and local_end must differ")
        if self.venue_time_zone:
            zone(self.venue_time_zone)
        return self


class CommitmentOut(Orm):
    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    source: str
    label: str | None
    venue_time_zone: str | None


class AvailabilityOut(BaseModel):
    time_zone: str
    rules: list[AvailabilityRuleOut]
    exceptions: list[AvailabilityExceptionOut]
    commitments: list[CommitmentOut]
    weekly_hours: float | None = Field(description="Nominal hours per week; null when no rules")


class AvailabilityCheckOut(BaseModel):
    state: Literal["available", "unavailable", "unknown", "offered", "held", "confirmed"]
    reason: str


EmployerPrefKind = Literal["follow", "hide_from", "mute", "block"]


class EmployerPreferenceIn(BaseModel):
    employer_id: uuid.UUID
    kind: EmployerPrefKind


class EmployerPreferenceOut(BaseModel):
    id: uuid.UUID
    employer_id: uuid.UUID
    employer_name: str
    kind: str


class EmployerDirectoryItem(Orm):
    id: uuid.UUID
    name: str
    verification_status: str


# ---- employer talent search (consent-based) ----
HoursCompat = Literal["compatible", "incompatible", "unknown", "not_requested"]
PayCompat = Literal["compatible", "not_confirmed", "not_requested"]


class TalentSearchIn(BaseModel):
    kind: WorkKind
    job_id: uuid.UUID | None = None
    suburb: str | None = Field(None, max_length=100)
    state: State | None = None
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(
        default=[], max_length=10
    )
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    # Or the venue's own local date and times (an end at or before the start runs overnight), so
    # a web form never does time-zone arithmetic. Resolved into starts_at/ends_at below.
    window_date: date | None = None
    window_start: time | None = None
    window_end: time | None = None
    window_time_zone: str = Field("Australia/Melbourne", max_length=64)
    min_weekly_hours: Decimal | None = Field(None, ge=0, le=168)
    availability: Literal["available_or_unknown", "any"] = "available_or_unknown"
    after: str | None = Field(None, max_length=64)
    limit: int = Field(25, ge=1, le=25)

    @model_validator(mode="after")
    def _ok(self) -> "TalentSearchIn":
        local = (self.window_date, self.window_start, self.window_end)
        if any(v is not None for v in local):
            if self.starts_at is not None or self.ends_at is not None:
                raise ValueError("use either starts_at/ends_at or window_date/start/end")
            if any(v is None for v in local):
                raise ValueError("provide window_date, window_start and window_end together")
            assert self.window_date and self.window_start and self.window_end  # noqa: S101
            if self.window_start == self.window_end:
                raise ValueError("window_start and window_end must differ")
            self.starts_at, self.ends_at = local_interval(
                self.window_time_zone, self.window_date, self.window_start, self.window_end
            )
        if (self.starts_at is None) != (self.ends_at is None):
            raise ValueError("provide both starts_at and ends_at, or neither")
        if self.starts_at and self.ends_at:
            if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
                raise ValueError("starts_at and ends_at must include a UTC offset")
            if self.ends_at <= self.starts_at:
                raise ValueError("ends_at must be after starts_at")
            if (self.ends_at - self.starts_at).days > 14:
                raise ValueError("search window can be at most 14 days")
        return self


class TalentAvailability(BaseModel):
    state: Literal["available", "unavailable", "unknown", "not_requested"]
    reason: str


class TalentCandidateOut(BaseModel):
    ref: str = Field(description="Opaque per-employer reference; not the candidate's account id")
    display_name: str
    headline: str | None
    area: str | None
    skills: list[str]
    kinds_offered: list[WorkKind]
    availability: TalentAvailability
    hours_compat: HoursCompat
    pay_compat: PayCompat
    notice_period_days: int | None
    available_from: date | None
    prefers_your_business: bool
    unknowns: list[str]


class TalentSearchOut(BaseModel):
    items: list[TalentCandidateOut]
    next_after: str | None
    invite_available: bool
    invite_unavailable_reason: str | None
    notes: list[str]


# ---- invitations and messaging (ADR-010) ----
InvitationStatus = Literal["pending", "accepted", "declined", "withdrawn", "expired"]


class InvitationIn(BaseModel):
    ref: str = Field(min_length=8, max_length=64, description="Opaque reference from talent search")
    job_id: uuid.UUID
    kind: WorkKind
    note: Annotated[str, StringConstraints(max_length=500)] = ""
    expires_in_days: int | None = Field(None, ge=1, le=14)


class InvitationTerms(BaseModel):
    """What the candidate is invited to, as the job stood (invited) or stands (current)."""

    model_config = ConfigDict(extra="ignore")
    business: str
    job_id: str
    title: str
    suburb: str | None = None
    state: str | None = None
    employment_type: str
    engagement_basis: str
    duration_type: str
    hours_pattern: str
    min_weekly_hours: str | None = None
    max_weekly_hours: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    pay_min: str | None = None
    pay_max: str | None = None
    pay_period: str | None = None
    pay_basis: str
    super_included: bool | None = None


class InvitationOut(BaseModel):
    """Candidate's view. Interest only: not an application, an employment offer or a shift hold."""

    id: uuid.UUID
    status: InvitationStatus
    kind: WorkKind
    note: str
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    unread: bool
    terms: InvitationTerms
    current_terms: InvitationTerms | None
    current_terms_hash: str | None
    terms_changed: bool
    job_open: bool
    can_accept: bool
    conversation_id: uuid.UUID | None
    acceptance_note: str


class InvitationList(BaseModel):
    items: list[InvitationOut]
    unread: int


class InvitationAcceptIn(BaseModel):
    terms_hash: str = Field(min_length=8, max_length=64)


class EmployerInvitationOut(BaseModel):
    id: uuid.UUID
    status: InvitationStatus
    kind: WorkKind
    job_id: uuid.UUID
    job_title: str
    note: str
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    candidate_label: str
    candidate_ref: str
    conversation_id: uuid.UUID | None


class InvitationSettingsIn(BaseModel):
    enabled: bool


class InvitationSettingsOut(BaseModel):
    invitations_enabled: bool


class InboxSummary(BaseModel):
    unread_invitations: int
    unread_conversations: int


class MessageIn(BaseModel):
    body: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    client_key: str | None = Field(None, max_length=80)


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_role: Literal["candidate", "employer"]
    mine: bool
    body: str = Field(description="Plain text. Render as text, never as HTML.")
    created_at: datetime


class MessagePage(BaseModel):
    items: list[MessageOut]
    next_before: uuid.UUID | None


class ConversationOut(BaseModel):
    id: uuid.UUID
    invitation_id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    counterpart: str
    status: Literal["open", "closed"]
    closed_reason: str | None
    last_message_at: datetime | None
    unread: bool


class ReportIn(BaseModel):
    reason: Annotated[str, StringConstraints(min_length=3, max_length=500)]
    message_id: uuid.UUID | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    status: str
