"""SQLAlchemy models. Enumerations are stored as text with CHECK constraints.

Privacy classification (see docs/architecture/ERD.md): users/candidate_profiles/resumes/
applications are personal information; audit_events and application_events are append-only.
"""

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID, ExcludeConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

USER_ROLES = ("candidate", "employer", "admin")
MEMBER_ROLES = ("owner", "recruiter", "viewer")
VERIFICATION_STATUSES = ("unverified", "pending", "verified", "rejected")
JOB_STATUSES = ("draft", "published", "closed", "expired", "unpublished")
EMPLOYMENT_TYPES = ("full_time", "part_time", "casual", "contract", "shift")
PAY_PERIODS = ("hour", "day", "week", "month", "year")
PAY_BASES = ("disclosed", "estimated", "not_disclosed")
APPLICATION_STATUSES = (
    "submitted",
    "under_review",
    "shortlisted",
    "interview",
    "offer",
    "hired",
    "rejected",
    "withdrawn",
)
SOURCE_STATUSES = ("active", "suspended", "revoked")
# Employment basis, duration and schedule are separate facts. employment_type stays for
# compatibility; "shift" is a way of scheduling work, not a legal employment category.
ENGAGEMENT_BASES = ("employee", "contractor", "unspecified")
DURATION_TYPES = ("ongoing", "fixed_term", "one_off", "unspecified")
HOURS_PATTERNS = ("full_time", "part_time", "casual", "unspecified")
WORK_KINDS = ("permanent", "temporary")
AVAILABILITY_STATES = ("available", "unavailable", "unknown", "offered", "held", "confirmed")
COMMITMENT_STATUSES = ("held", "confirmed")
EXCEPTION_STATES = ("available", "unavailable")
EMPLOYER_PREFERENCE_KINDS = ("follow", "hide_from", "mute", "block")
INVITATION_STATUSES = ("pending", "accepted", "declined", "withdrawn", "expired")
CONVERSATION_STATUSES = ("open", "closed")
CONSENT_KINDS = (
    "terms",
    "privacy",
    "talent_discovery",
    "talent_discovery_permanent",
    "talent_discovery_temporary",
    "marketing",
)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Base(DeclarativeBase):
    pass


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(_in("role", USER_ROLES), name="ck_users_role"),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Consent(Base):
    """Append-only consent history; latest row per (user, kind) is the current state."""

    __tablename__ = "consents"
    __table_args__ = (CheckConstraint(_in("kind", CONSENT_KINDS), name="ck_consent_kind"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CandidateProfile(TimestampMixin, Base):
    __tablename__ = "candidate_profiles"
    __table_args__ = (CheckConstraint("max_commute_km IS NULL OR max_commute_km > 0"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    headline: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(Text)
    suburb: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(3))
    postcode: Mapped[str | None] = mapped_column(String(4))
    preferred_employment_types: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'")
    )
    min_hourly_pay: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    max_commute_km: Mapped[int | None] = mapped_column(Integer)
    discoverable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Pause or allow employer invitations. Separate from discoverability and from ending a thread.
    invitations_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    # IANA zone for recurring availability rules ("every Tuesday 17:00-23:00" means local time).
    time_zone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="Australia/Melbourne"
    )


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"
    __table_args__ = (CheckConstraint(_in("source", ("self_declared", "inferred", "verified"))),)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="self_declared")


class JobSkill(Base):
    __tablename__ = "job_skills"
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class Resume(TimestampMixin, Base):
    __tablename__ = "resumes"
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    versions: Mapped[list["ResumeVersion"]] = relationship(
        order_by="ResumeVersion.version", lazy="selectin"
    )


class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    __table_args__ = (UniqueConstraint("resume_id", "version"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    resume_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Employer(TimestampMixin, Base):
    __tablename__ = "employers"
    __table_args__ = (
        CheckConstraint(_in("verification_status", VERIFICATION_STATUSES), name="ck_employer_vs"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    abn: Mapped[str | None] = mapped_column(String(11), unique=True)
    verification_status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="unverified"
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    verification_evidence: Mapped[str | None] = mapped_column(Text)


class EmployerMembership(TimestampMixin, Base):
    __tablename__ = "employer_memberships"
    __table_args__ = (
        UniqueConstraint("employer_id", "user_id"),
        CheckConstraint(_in("role", MEMBER_ROLES), name="ck_membership_role"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)


class Location(TimestampMixin, Base):
    __tablename__ = "locations"
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    suburb: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(3), nullable=False)
    postcode: Mapped[str] = mapped_column(String(4), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False, server_default="AU")


class Job(TimestampMixin, Base):
    """Canonical job. Third-party sightings live in job_source_observations."""

    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(_in("status", JOB_STATUSES), name="ck_jobs_status"),
        CheckConstraint(_in("employment_type", EMPLOYMENT_TYPES), name="ck_jobs_emp_type"),
        CheckConstraint(_in("origin", ("direct", "ingested")), name="ck_jobs_origin"),
        CheckConstraint(_in("pay_basis", PAY_BASES), name="ck_jobs_pay_basis"),
        CheckConstraint(_in("engagement_basis", ENGAGEMENT_BASES), name="ck_jobs_engagement"),
        CheckConstraint(_in("duration_type", DURATION_TYPES), name="ck_jobs_duration"),
        CheckConstraint(_in("hours_pattern", HOURS_PATTERNS), name="ck_jobs_hours_pattern"),
        CheckConstraint(
            "min_weekly_hours IS NULL OR max_weekly_hours IS NULL "
            "OR min_weekly_hours <= max_weekly_hours",
            name="ck_jobs_weekly_hours_range",
        ),
        CheckConstraint(
            "start_date IS NULL OR end_date IS NULL OR start_date <= end_date",
            name="ck_jobs_date_range",
        ),
        CheckConstraint(
            "pay_period IS NULL OR " + _in("pay_period", PAY_PERIODS), name="ck_jobs_pay_period"
        ),
        CheckConstraint(
            "pay_min IS NULL OR pay_max IS NULL OR pay_min <= pay_max", name="ck_jobs_pay_range"
        ),
        CheckConstraint(
            "(pay_min IS NULL AND pay_max IS NULL) OR pay_period IS NOT NULL",
            name="ck_jobs_pay_needs_period",
        ),
        CheckConstraint(
            "(pay_min IS NULL AND pay_max IS NULL) = (pay_basis = 'not_disclosed')",
            name="ck_jobs_pay_basis_consistent",
        ),
        CheckConstraint(
            "origin <> 'direct' OR employer_id IS NOT NULL", name="ck_jobs_direct_owner"
        ),
        CheckConstraint(
            "origin <> 'ingested' OR apply_url IS NOT NULL", name="ck_jobs_ingested_url"
        ),
        Index("ix_jobs_search", "search_vector", postgresql_using="gin"),
        Index("ix_jobs_status_published", "status", "published_at"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"))
    origin: Mapped[str] = mapped_column(String(16), nullable=False, server_default="direct")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="draft")
    employment_type: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    suburb: Mapped[str | None] = mapped_column(String(100), index=True)
    state: Mapped[str | None] = mapped_column(String(3))
    postcode: Mapped[str | None] = mapped_column(String(4))
    pay_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    pay_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    pay_period: Mapped[str | None] = mapped_column(String(8))
    pay_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="AUD")
    super_included: Mapped[bool | None] = mapped_column(Boolean)
    pay_basis: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="not_disclosed"
    )
    apply_url: Mapped[str | None] = mapped_column(Text)
    source_employer_name: Mapped[str | None] = mapped_column(String(200))
    attribution: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6))  # approximate suburb centroid
    lng: Mapped[float | None] = mapped_column(Numeric(9, 6))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    engagement_basis: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="unspecified"
    )
    duration_type: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="unspecified"
    )
    hours_pattern: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="unspecified"
    )
    min_weekly_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    max_weekly_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    role_code: Mapped[str | None] = mapped_column(
        ForeignKey("hospitality_roles.code", ondelete="SET NULL"), index=True
    )
    pay_assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pay_assessments.id", ondelete="SET NULL")
    )
    search_vector: Mapped[Any] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') "
            "|| ' ' || coalesce(category,'') || ' ' || coalesce(suburb,''))",
            persisted=True,
        ),
    )


class JobVersion(Base):
    __tablename__ = "job_versions"
    __table_args__ = (UniqueConstraint("job_id", "version"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IngestionSource(TimestampMixin, Base):
    __tablename__ = "ingestion_sources"
    __table_args__ = (CheckConstraint(_in("status", SOURCE_STATUSES), name="ck_source_status"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    # Scheduling and health (managed by the ingestion worker).
    schedule_interval_seconds: Mapped[int | None] = mapped_column(Integer)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    min_interval_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("60")
    )
    consecutive_failures: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    circuit_open_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


TASK_STATUSES = ("queued", "running", "succeeded", "rejected", "dead")


class IngestionTask(Base):
    """Durable work item. `dead` is the dead-letter state: needs an operator to requeue."""

    __tablename__ = "ingestion_tasks"
    __table_args__ = (
        CheckConstraint(_in("status", TASK_STATUSES), name="ck_task_status"),
        CheckConstraint("attempts >= 0 AND max_attempts >= 1", name="ck_task_attempts"),
        Index(
            "uq_ingestion_tasks_idem",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
        Index("ix_ingestion_tasks_claim", "status", "run_after"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ingestion_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))
    run_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_by: Mapped[str | None] = mapped_column(String(200))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str | None] = mapped_column(String(200))
    last_error: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SourcePermission(Base):
    """Evidence that NUA CREW may ingest from a source. No row => no fetch (fail closed)."""

    __tablename__ = "source_permissions"
    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ingestion_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    legal_basis: Mapped[str] = mapped_column(Text, nullable=False)
    license: Mapped[str] = mapped_column(Text, nullable=False)
    attribution: Mapped[str | None] = mapped_column(Text)
    permitted_fields: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class JobSourceObservation(Base):
    __tablename__ = "job_source_observations"
    __table_args__ = (UniqueConstraint("source_id", "external_id"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ingestion_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(String(200), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SourceFetchRun(Base):
    __tablename__ = "source_fetch_runs"
    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ingestion_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    error: Mapped[str | None] = mapped_column(Text)


class Application(TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint(_in("status", APPLICATION_STATUSES), name="ck_applications_status"),
        # One live application per candidate per vacancy; withdrawing frees the slot.
        Index(
            "uq_applications_active",
            "job_id",
            "candidate_id",
            unique=True,
            postgresql_where=text("status <> 'withdrawn'"),
        ),
        UniqueConstraint("candidate_id", "idempotency_key", name="uq_applications_idem"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resume_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("resume_versions.id"))
    cover_note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="submitted")
    idempotency_key: Mapped[str | None] = mapped_column(String(100))


class ApplicationEvent(Base):
    """Append-only (DB trigger). Private employer notes have visible_to_candidate = false."""

    __tablename__ = "application_events"
    __table_args__ = (
        CheckConstraint(
            _in("event_type", ("submitted", "status_changed", "withdrawn", "note")),
            name="ck_app_event_type",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(16))
    to_status: Mapped[str | None] = mapped_column(String(16))
    # Plain id, not a foreign key: append-only history cannot be nulled out when an account goes.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    actor_role: Mapped[str] = mapped_column(String(16), nullable=False)
    visible_to_candidate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditEvent(Base):
    """Append-only (DB trigger). Metadata must never contain credentials or resume text."""

    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = _uuid_pk()
    # Deliberately NOT a foreign key: audit history must survive account deletion (ADR-007).
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    meta: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RefreshToken(Base):
    """Rotating refresh tokens (hashed). Reuse of a rotated token revokes the whole family."""

    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    device_label: Mapped[str | None] = mapped_column(String(100))
    family_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SavedJob(Base):
    __tablename__ = "saved_jobs"
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SavedSearch(Base):
    __tablename__ = "saved_searches"
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    alerts_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    last_alerted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DeviceToken(Base):
    """Push tokens. Deleted on logout, account deletion, or when the provider reports them dead."""

    __tablename__ = "device_tokens"
    __table_args__ = (
        CheckConstraint(_in("platform", ("ios", "android")), name="ck_device_platform"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


def _candidate_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )


class WorkPreference(TimestampMixin, Base):
    """One row per kind of work a candidate may want. Turning a kind off keeps its fields, so
    "Both" never overwrites either side and switching one off does not silently erase it."""

    __tablename__ = "work_preferences"
    __table_args__ = (
        UniqueConstraint("candidate_id", "kind", name="uq_work_pref_kind"),
        CheckConstraint(_in("kind", WORK_KINDS), name="ck_work_pref_kind"),
        CheckConstraint(
            "min_weekly_hours IS NULL OR max_weekly_hours IS NULL "
            "OR min_weekly_hours <= max_weekly_hours",
            name="ck_work_pref_hours_range",
        ),
        CheckConstraint("max_travel_km IS NULL OR max_travel_km > 0", name="ck_work_pref_travel"),
        CheckConstraint(
            "notice_period_days IS NULL OR notice_period_days BETWEEN 0 AND 365",
            name="ck_work_pref_notice",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # Explicit consent for employers to find this person for this kind of work (default off).
    discoverable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Preferences about the arrangement, never proof of status (an ABN box is not proof of
    # contractor status).
    engagement_bases: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'")
    )
    hours_patterns: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'")
    )
    min_weekly_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    max_weekly_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    # Private asking floor. Never returned to employers.
    min_hourly_pay: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    max_travel_km: Mapped[int | None] = mapped_column(Integer)
    notice_period_days: Mapped[int | None] = mapped_column(Integer)
    available_from: Mapped[date | None] = mapped_column(Date)


class AvailabilityRule(Base):
    """A recurring weekly window in the candidate's local time zone. end_time <= start_time means
    the window runs overnight into the next day. Several windows per weekday are allowed."""

    __tablename__ = "availability_rules"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_avail_rule_weekday"),
        CheckConstraint("start_time <> end_time", name="ck_avail_rule_nonempty"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # Monday = 0
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)


class AvailabilityException(Base):
    """A dated override in local time. 'unavailable' always wins over recurring availability."""

    __tablename__ = "availability_exceptions"
    __table_args__ = (
        CheckConstraint(_in("state", EXCEPTION_STATES), name="ck_avail_exc_state"),
        CheckConstraint("start_date <= end_date", name="ck_avail_exc_dates"),
        CheckConstraint(
            "(start_time IS NULL) = (end_time IS NULL)", name="ck_avail_exc_times_together"
        ),
        CheckConstraint(
            "start_time IS NULL OR start_time <> end_time", name="ck_avail_exc_nonempty"
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    state: Mapped[str] = mapped_column(String(12), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)  # null = all day
    end_time: Mapped[time | None] = mapped_column(Time)


class Commitment(TimestampMixin, Base):
    """Time the worker is not free: a held or confirmed commitment, stored as UTC instants.
    Applications alone never create one."""

    __tablename__ = "commitments"
    __table_args__ = (
        CheckConstraint(_in("status", COMMITMENT_STATUSES), name="ck_commitment_status"),
        CheckConstraint("ends_at > starts_at", name="ck_commitment_range"),
        Index("ix_commitments_candidate_time", "candidate_id", "starts_at", "ends_at"),
        ExcludeConstraint(
            ("candidate_id", "="),
            (text("tstzrange(starts_at, ends_at, '[)')"), "&&"),
            where=text("status = 'confirmed'"),
            using="gist",
            name="ex_commitments_confirmed_overlap",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="manual")
    label: Mapped[str | None] = mapped_column(String(100))
    # Venue zone context for display; the instants above are the source of truth.
    venue_time_zone: Mapped[str | None] = mapped_column(String(64))


class Shift(TimestampMixin, Base):
    __tablename__ = "shifts"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_shift_window"),
        CheckConstraint("capacity BETWEEN 1 AND 50", name="ck_shift_capacity"),
        CheckConstraint("hourly_rate_minor > 0", name="ck_shift_rate"),
        CheckConstraint("status IN ('open', 'cancelled')", name="ck_shift_status"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    time_zone: Mapped[str] = mapped_column(String(64))
    capacity: Mapped[int] = mapped_column(Integer)
    hourly_rate_minor: Mapped[int] = mapped_column(Integer)
    super_included: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(12), server_default="open")


class ShiftBooking(TimestampMixin, Base):
    __tablename__ = "shift_bookings"
    __table_args__ = (
        UniqueConstraint("shift_id", "candidate_id", name="uq_shift_candidate"),
        CheckConstraint(
            "status IN ('offered', 'confirmed', 'declined', 'cancelled')", name="ck_booking_status"
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id", ondelete="CASCADE"))
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    candidate_label: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(12), server_default="offered")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    commitment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("commitments.id", ondelete="RESTRICT"), unique=True
    )
    reason: Mapped[str | None] = mapped_column(String(1000))


class ShiftTimesheet(TimestampMixin, Base):
    __tablename__ = "shift_timesheets"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at AND break_minutes >= 0", name="ck_timesheet_window"),
        CheckConstraint(
            "status IN ('submitted', 'approved', 'disputed')", name="ck_timesheet_status"
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shift_bookings.id", ondelete="CASCADE"), unique=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    break_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), server_default="submitted")
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    note: Mapped[str | None] = mapped_column(String(1000))
    review_note: Mapped[str | None] = mapped_column(String(1000))


class ShiftAttendanceEvent(Base):
    """Append-only attendance history. Corrections add events; originals are never edited."""

    __tablename__ = "shift_attendance_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('check_in', 'check_out', 'correction_requested', 'correction_approved', "
            "'correction_rejected', 'no_show_marked', 'no_show_reversed')",
            name="ck_attendance_kind",
        ),
        CheckConstraint("actor_role IN ('candidate', 'employer')", name="ck_attendance_actor"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shift_bookings.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(24))
    actor_role: Mapped[str] = mapped_column(String(10))
    # Server clock at the moment the event was recorded.
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    # For corrections: the instant the person says the event really happened.
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_kind: Mapped[str | None] = mapped_column(String(10))
    ref_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("shift_attendance_events.id", ondelete="RESTRICT")
    )
    time_zone: Mapped[str] = mapped_column(String(64))
    note: Mapped[str | None] = mapped_column(String(1000))


class ShiftTimesheetVersion(Base):
    """Append-only snapshot of every submitted or reviewed version of a timesheet."""

    __tablename__ = "shift_timesheet_versions"
    __table_args__ = (
        UniqueConstraint("booking_id", "version", "status", name="uq_timesheet_version_status"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shift_bookings.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    break_minutes: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(1000))
    review_note: Mapped[str | None] = mapped_column(String(1000))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class HospitalityDepartment(Base):
    __tablename__ = "hospitality_departments"
    code: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    workstream: Mapped[str] = mapped_column(String(12))
    sort_order: Mapped[int] = mapped_column(Integer)


class HospitalityRole(Base):
    """Curated NUA search taxonomy. A role is never an authoritative award classification."""

    __tablename__ = "hospitality_roles"
    code: Mapped[str] = mapped_column(String(12), primary_key=True)  # stable: HC-0001..
    title: Mapped[str] = mapped_column(String(200))
    title_norm: Mapped[str] = mapped_column(String(220), index=True)
    department_code: Mapped[str] = mapped_column(
        ForeignKey("hospitality_departments.code"), index=True
    )
    tier: Mapped[int] = mapped_column(Integer)  # seniority: 1 = highest
    workstream: Mapped[str] = mapped_column(String(12))
    sort_order: Mapped[int] = mapped_column(Integer)  # display order, separate from seniority
    scope_text: Mapped[str] = mapped_column(String(200))
    compliance_note: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    indicative_text: Mapped[str] = mapped_column(String(200))
    indicative_level_min: Mapped[int | None] = mapped_column(Integer)
    indicative_level_max: Mapped[int | None] = mapped_column(Integer)
    duties_based: Mapped[bool] = mapped_column(Boolean)
    apprentice: Mapped[bool] = mapped_column(Boolean)
    introductory: Mapped[bool] = mapped_column(Boolean)
    needs_review: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(10), server_default="active")


class HospitalityRoleAlias(Base):
    __tablename__ = "hospitality_role_aliases"
    __table_args__ = (UniqueConstraint("role_code", "alias_norm", name="uq_role_alias"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    role_code: Mapped[str] = mapped_column(
        ForeignKey("hospitality_roles.code", ondelete="CASCADE"), index=True
    )
    alias: Mapped[str] = mapped_column(String(200))
    alias_norm: Mapped[str] = mapped_column(String(220), index=True)


class VenueType(Base):
    __tablename__ = "venue_types"
    code: Mapped[str] = mapped_column(String(24), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    # Starting points for an award coverage check only; the employer must confirm coverage.
    award_leads: Mapped[list[str]] = mapped_column(ARRAY(String))
    coverage_confidence: Mapped[str] = mapped_column(String(10))


class RoleVenueCompatibility(Base):
    __tablename__ = "role_venue_compatibility"
    role_code: Mapped[str] = mapped_column(
        ForeignKey("hospitality_roles.code", ondelete="CASCADE"), primary_key=True
    )
    venue_code: Mapped[str] = mapped_column(
        ForeignKey("venue_types.code", ondelete="CASCADE"), primary_key=True
    )


class IndustrialInstrument(Base):
    __tablename__ = "industrial_instruments"
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(12), server_default="award")
    source_url: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), server_default="active")


class AwardClassification(Base):
    __tablename__ = "award_classifications"
    __table_args__ = (UniqueConstraint("instrument_code", "code", name="uq_award_class"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    instrument_code: Mapped[str] = mapped_column(ForeignKey("industrial_instruments.code"))
    code: Mapped[str] = mapped_column(String(12))
    label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(10))  # operative | manager
    sort_order: Mapped[int] = mapped_column(Integer)


class AwardRateVersion(Base):
    __tablename__ = "award_rate_versions"
    __table_args__ = (
        UniqueConstraint("classification_id", "effective_from", name="uq_rate_effective"),
        CheckConstraint(
            "data_status IN ('supplied_unverified', 'verified')", name="ck_rate_data_status"
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    classification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("award_classifications.id", ondelete="CASCADE"), index=True
    )
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    weekly_minor: Mapped[int] = mapped_column(Integer)
    hourly_minor: Mapped[int] = mapped_column(Integer)
    supplied_casual_ordinary_minor: Mapped[int | None] = mapped_column(Integer)
    annual_minimum_minor: Mapped[int | None] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(Text)
    data_status: Mapped[str] = mapped_column(String(20))
    source_note: Mapped[str] = mapped_column(Text)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PenaltyRuleVersion(Base):
    __tablename__ = "penalty_rule_versions"
    __table_args__ = (
        UniqueConstraint(
            "instrument_code",
            "employment",
            "day_kind",
            "effective_from",
            "classification_codes",
            name="uq_penalty_rule",
        ),
        CheckConstraint("employment IN ('permanent', 'casual')", name="ck_penalty_employment"),
        CheckConstraint(
            "day_kind IN ('weekday', 'saturday', 'sunday', 'public_holiday')",
            name="ck_penalty_day_kind",
        ),
        CheckConstraint(
            "data_status IN ('supplied_unverified', 'verified')", name="ck_penalty_data_status"
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    instrument_code: Mapped[str] = mapped_column(ForeignKey("industrial_instruments.code"))
    employment: Mapped[str] = mapped_column(String(10))
    classification_codes: Mapped[list[str]] = mapped_column(ARRAY(String))
    day_kind: Mapped[str] = mapped_column(String(16))
    # Basis points of the permanent ordinary hourly rate; casual rows include the loading.
    multiplier_bp: Mapped[int] = mapped_column(Integer)
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    source_url: Mapped[str] = mapped_column(Text)
    data_status: Mapped[str] = mapped_column(String(20))
    source_note: Mapped[str] = mapped_column(Text)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PublicHoliday(Base):
    """Administrator-maintained. Empty until an authoritative calendar is loaded."""

    __tablename__ = "public_holidays"
    __table_args__ = (UniqueConstraint("state", "holiday_date", name="uq_public_holiday"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    state: Mapped[str] = mapped_column(String(3))
    holiday_date: Mapped[date] = mapped_column(Date)
    name: Mapped[str] = mapped_column(String(120))
    source_url: Mapped[str] = mapped_column(Text)


class PayAssessment(Base):
    """Immutable record of one pay check: inputs, the rule versions used and the result."""

    __tablename__ = "pay_assessments"
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="SET NULL"), index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    effective_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24))
    input_hash: Mapped[str] = mapped_column(String(64))
    input: Mapped[dict[str, Any]] = mapped_column(JSONB)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB)


class PayAssessmentAcknowledgement(Base):
    """An employer's recorded acknowledgement that an assessment still needs human review."""

    __tablename__ = "pay_assessment_acknowledgements"
    id: Mapped[uuid.UUID] = _uuid_pk()
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pay_assessments.id", ondelete="CASCADE"), unique=True
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    note: Mapped[str | None] = mapped_column(String(1000))


class CandidateRole(Base):
    """A person's own role preferences. Private: employers never read this table."""

    __tablename__ = "candidate_roles"
    __table_args__ = (UniqueConstraint("candidate_id", "role_code", name="uq_candidate_role"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), index=True
    )
    role_code: Mapped[str] = mapped_column(ForeignKey("hospitality_roles.code"))
    years_experience: Mapped[int | None] = mapped_column(Integer)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingOrder(TimestampMixin, Base):
    __tablename__ = "billing_orders"
    __table_args__ = (
        UniqueConstraint("employer_id", "client_key", name="uq_billing_order_retry"),
        CheckConstraint("amount_minor IN (1900, 3000, 4900)", name="ck_order_amount"),
        CheckConstraint(
            "status IN ('pending', 'settled', 'expired', 'refund_required', 'refunded')",
            name="ck_order_status",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String(30))
    amount_minor: Mapped[int] = mapped_column(Integer)
    client_key: Mapped[str] = mapped_column(String(80))
    terms_hash: Mapped[str] = mapped_column(String(64))
    checkout_session_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    payment_intent_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    refund_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    review_required: Mapped[bool] = mapped_column(Boolean, server_default="false")
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PromotionReservation(TimestampMixin, Base):
    __tablename__ = "promotion_reservations"
    __table_args__ = (
        CheckConstraint("slot BETWEEN 1 AND 5 AND ends_at > starts_at", name="ck_promotion_slot"),
        CheckConstraint("status IN ('held', 'active', 'released')", name="ck_promotion_status"),
        ExcludeConstraint(
            ("market", "="),
            ("slot", "="),
            (text("tstzrange(starts_at, ends_at, '[)')"), "&&"),
            using="gist",
            where=text("status IN ('held', 'active')"),
            name="ex_promotion_capacity",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing_orders.id", ondelete="CASCADE"), unique=True
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    market: Mapped[str] = mapped_column(String(300))
    slot: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    hold_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), server_default="held")


class PublishedPromotion(Base):
    """Public placement projection: no order, receipt, amount or account information."""

    __tablename__ = "published_promotions"
    id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("promotion_reservations.id", ondelete="CASCADE"), primary_key=True
    )
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    market: Mapped[str] = mapped_column(String(300))
    slot: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, server_default="true")


class AdEntitlement(Base):
    __tablename__ = "ad_entitlements"
    id: Mapped[uuid.UUID] = _uuid_pk()
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing_orders.id", ondelete="CASCADE"), unique=True
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, server_default="true")


class BillingLedger(Base):
    __tablename__ = "billing_ledger"
    __table_args__ = (UniqueConstraint("provider", "event_key", name="uq_billing_provider_event"),)
    id: Mapped[uuid.UUID] = _uuid_pk()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("billing_orders.id", ondelete="CASCADE"))
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(40))
    event_key: Mapped[str] = mapped_column(String(200))
    fingerprint: Mapped[str] = mapped_column(String(64))
    event_kind: Mapped[str] = mapped_column(String(20))
    amount_minor: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmployerPreference(Base):
    """A candidate's private stance on one employer.

    follow: the employer may be told this person prefers working with them (label only, no boost).
    hide_from: do not show this person in that employer's talent search (best effort).
    mute: do not show that employer's jobs to this person.
    """

    __tablename__ = "employer_preferences"
    __table_args__ = (
        UniqueConstraint("candidate_id", "employer_id", "kind", name="uq_employer_pref"),
        CheckConstraint(_in("kind", EMPLOYER_PREFERENCE_KINDS), name="ck_employer_pref_kind"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    candidate_id: Mapped[uuid.UUID] = _candidate_fk()
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Invitation(TimestampMixin, Base):
    """An employer's expression of hiring interest in a consenting candidate for one open job.
    Not an application, an employment offer, a shift hold or a booking."""

    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(_in("status", INVITATION_STATUSES), name="ck_invitation_status"),
        CheckConstraint(_in("kind", WORK_KINDS), name="ck_invitation_kind"),
        CheckConstraint("char_length(note) <= 500", name="ck_invitation_note_len"),
        # one live invitation per employer + candidate + job, whichever teammate sent it
        Index(
            "uq_invitation_live",
            "employer_id",
            "candidate_id",
            "job_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'accepted')"),
        ),
        UniqueConstraint("employer_id", "idempotency_key", name="uq_invitation_idem"),
        Index("ix_invitation_candidate_status", "candidate_id", "status"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sent_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default="pending")
    note: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    job_version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)  # terms as invited
    accepted_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # terms as accepted
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str | None] = mapped_column(String(80))
    request_hash: Mapped[str | None] = mapped_column(String(64))


class Conversation(Base):
    """Exactly one per accepted invitation."""

    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint(_in("status", CONVERSATION_STATUSES), name="ck_conversation_status"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(8), nullable=False, server_default="open")
    closed_reason: Mapped[str | None] = mapped_column(String(24))  # candidate_closed | blocked
    # False after a candidate block: the employer side loses read access, history is kept.
    employer_access: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    candidate_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    employer_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("sender_role IN ('candidate', 'employer')", name="ck_message_role"),
        CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="ck_message_body_len"),
        UniqueConstraint("conversation_id", "sender_role", "client_key", name="uq_message_client"),
        Index("ix_messages_conversation_created", "conversation_id", "created_at", "id"),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    sender_role: Mapped[str] = mapped_column(String(10), nullable=False)
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)  # plain text only
    client_key: Mapped[str | None] = mapped_column(String(80))
    request_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MessageReport(Base):
    """Minimal support record. Keeps a copy of the reported text so it survives deletion."""

    __tablename__ = "message_reports"
    id: Mapped[uuid.UUID] = _uuid_pk()
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL")
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL")
    )
    reporter_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reporter_role: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    excerpt: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TalentExposure(Base):
    """Which candidates an employer has been shown, and when. It bounds how many distinct people
    one employer can probe per day, and is the only way an opaque reference can be resolved."""

    __tablename__ = "talent_exposures"
    employer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employers.id", ondelete="CASCADE"), primary_key=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    first_shown_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_shown_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CandidateDocument(Base, TimestampMixin):
    __tablename__ = "candidate_documents"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('resume','rsa','food_safety','first_aid','qualification','other')",
            name="ck_document_kind",
        ),
        CheckConstraint("status IN ('pending','ready')", name="ck_document_status"),
        CheckConstraint("size_bytes > 0 AND size_bytes <= 4194304", name="ck_document_size"),
        UniqueConstraint("candidate_id", "client_key", name="uq_document_client_key"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(160))
    filename: Mapped[str] = mapped_column(String(160))
    content_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    client_key: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(12), default="pending")
    sha256: Mapped[str | None] = mapped_column(String(64))
    issuer: Mapped[str | None] = mapped_column(String(160))
    jurisdiction: Mapped[str | None] = mapped_column(String(8))
    completed_on: Mapped[date | None] = mapped_column(Date)
    review_due_on: Mapped[date | None] = mapped_column(Date)
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ApplicationDocument(Base):
    __tablename__ = "application_documents"
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_documents.id", ondelete="CASCADE"), primary_key=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), index=True
    )


class DocumentDeletion(Base):
    __tablename__ = "document_deletions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
