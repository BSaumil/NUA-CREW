"""SQLAlchemy models. Enumerations are stored as text with CHECK constraints.

Privacy classification (see docs/architecture/ERD.md): users/candidate_profiles/resumes/
applications are personal information; audit_events and application_events are append-only.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
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
    __table_args__ = (
        CheckConstraint(
            _in("kind", ("terms", "privacy", "talent_discovery", "marketing")),
            name="ck_consent_kind",
        ),
    )
    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
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
    verified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
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
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
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
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditEvent(Base):
    """Append-only (DB trigger). Metadata must never contain credentials or resume text."""

    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = _uuid_pk()
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    meta: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
