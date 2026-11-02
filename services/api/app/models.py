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
# Employment basis, duration and schedule are separate facts. emp¶»§q«^