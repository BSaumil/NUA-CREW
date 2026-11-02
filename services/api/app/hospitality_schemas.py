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
¶»§q«^