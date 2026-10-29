"""Hospitality role taxonomy, award reference data, pay assessments and candidate role prefs."""

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.audit import audit
from app.deps import AdminUser, Candidate, CurrentUser, Recruiter, Session, Viewer
from app.errors import ApiError, conflict, not_found
from app.hospitality_schemas import (
    AcknowledgeIn,
    AwardCode,
    ClassificationOut,
    CoverageGuidanceOut,
    CoverageSuggestionOut,
    DepartmentOut,
    InstrumentOut,
    PayAssessmentIn,
    PayAssessmentOut,
    PayAssessmentResult,
    RoleOut,
    VenueTypeOut,
)
from app.models import (
    AwardClassification,
    AwardRateVersion,
    CandidateRole,
    HospitalityDepartment,
    HospitalityRole,
    IndustrialInstrument,
    Job,
    PayAssessment,
    PayAssessmentAcknowledgement,
    PenaltyRuleVersion,
    PublicHoliday,
    Resume,
    VenueType,
)
from app.services.hospitality.catalogue import search_roles, suggest_from_text
from app.services.hospitality.pay import acknowledged, run_assessment, today_in

router = APIRouter(prefix="/v1", tags=["hospitality"])


# ---- public reference data -------------------------------------------------------------------
@router.get("/taxonomy/departments", response_model=list[DepartmentOut])
async def departments(session: Session) -> list[DepartmentOut]:
    counts = dict(
        (
            await session.execute(
                select(HospitalityRole.department_code, func.count()).group_by(
                    HospitalityRole.department_code
                )
            )
        ).all()
    )
    rows = await session.scalars(
        select(HospitalityDepartment).order_by(HospitalityDepartment.sort_order)
    )
    return [
        DepartmentOut(
            code=d.code,
            name=d.name,
            workstream=d.workstream,
            sort_order=d.sort_order,
            role_count=counts.get(d.code, 0),
        )
        for d in rows
    ]


@router.get("/taxonomy/venue-types", response_model=list[VenueTypeOut])
async def venue_types(session: Session) -> list[VenueType]:
    return list(await session.scalars(select(VenueType).order_by(VenueType.name)))


@router.get("/taxonomy/roles", response_model=list[RoleOut])
async def roles(
    session: Session,
    q: str | None = Query(None, max_length=80),
    department: str | None = Query(None, max_length=48),
    venue_type: str | None = Query(None, max_length=24),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0, le=500),
) -> list[RoleOut]:
    return await search_roles(
        session, q, department=department, venue_type=venue_type, limit=limit, offset=offset
    )


@router.get("/taxonomy/roles/{code}", response_model=RoleOut)
async def role(code: str, session: Session) -> RoleOut:
    found = await search_roles(session, codes=[code], limit=1)
    if not found:
        raise not_found("role")
    return found[0]


@router.get("/awards", response_model=list[InstrumentOut])
async def awards(session: Session, on: date | None = None) -> list[InstrumentOut]:
    when = on or date.today()
    instruments = list(
        await session.scalars(select(IndustrialInstrument).order_by(IndustrialInstrument.code))
    )
    rows = await session.execute(
        select(AwardClassification, AwardRateVersion)
        .outerjoin(
            AwardRateVersion,
            (AwardRateVersion.classification_id == AwardClassification.id)
            & (AwardRateVersion.effective_from <= when)
            & ((AwardRateVersion.effective_to.is_(None)) | (AwardRateVersion.effective_to > when)),
        )
        .order_by(AwardClassification.instrument_code, AwardClassification.sort_order)
    )
    grouped: dict[str, list[ClassificationOut]] = {}
    for cls, rv in rows:
        grouped.setdefault(cls.instrument_code, []).append(
            ClassificationOut(
                code=cls.code,
                label=cls.label,
                description=cls.description,
                kind=cls.kind,
                hourly_minor=rv.hourly_minor if rv else None,
                weekly_minor=rv.weekly_minor if rv else None,
                annual_minimum_minor=rv.annual_minimum_minor if rv else None,
                effective_from=rv.effective_from if rv else None,
                data_status=rv.data_status if rv else None,
                source_url=rv.source_url if rv else None,
            )
        )
    return [
        InstrumentOut(
            code=i.code,
            title=i.title,
            source_url=i.source_url,
            classifications=grouped.get(i.code, []),
        )
        for i in instruments
    ]


QUESTIONS = [
    "Is your business mainly a restaurant, café, takeaway, hotel, bar/pub, club or caterer?",
    "Does an enterprise agreement apply to your business?",
    "What does this person actually do day to day, and who do they supervise or train?",
    "Is the person an adult, a junior, an apprentice or a trainee?",
]


@router.get("/awards/coverage-guidance", response_model=CoverageGuidanceOut)
async def coverage_guidance(
    session: Session,
    role_code: str | None = Query(None, max_length=12),
    venue_type: str | None = Query(None, max_length=24),
) -> CoverageGuidanceOut:
    """Starting points for a coverage check. These are leads, never a determination."""
    titles = {i.code: i.title for i in await session.scalars(select(IndustrialInstrument))}
    suggestions: list[CoverageSuggestionOut] = []
    leads: list[str] = []
    confidence = "review"
    venue = await session.get(VenueType, venue_type) if venue_type else None
    if venue:
        leads, confidence = list(venue.award_leads), venue.coverage_confidence
    role_row = await session.get(HospitalityRole, role_code) if role_code else None
    notes = ""
    for code in leads:
        suggestions.append(
            CoverageSuggestionOut(
                instrument=code,
                title=titles.get(code, code),
                confidence=confidence,
                reason=f"{venue.name if venue else 'This kind of venue'} is commonly covered by "
                "this award, but coverage depends on the business and the work.",
                classification_leads=[],
            )
        )
    if role_row is not None:
        lo, hi = role_row.indicative_level_min, role_row.indicative_level_max
        if lo is not None:
            span = f"Level {lo}" if lo == hi else f"Levels {lo} to {hi}"
            for s in suggestions:
                s.classification_leads = [f"L{n}" for n in range(lo, (hi or lo) + 1)]
            notes = f"The supplied guide lists {span} for this kind of role. "
        if role_row.needs_review:
            notes += (
                "This role is often managerial, a trade, or covered by another award, so coverage "
                "must be checked. "
            )
    if not suggestions:
        notes += "Choose a venue type to see the awards that usually apply. "
    return CoverageGuidanceOut(
        role_code=role_code,
        venue_type=venue_type,
        suggestions=suggestions,
        questions=QUESTIONS,
        note=(notes + "A job title never decides the award or the classification.").strip(),
    )


# ---- employer pay assessment -----------------------------------------------------------------
def _out(row: PayAssessment, ack: bool) -> PayAssessmentOut:
    return PayAssessmentOut(
        id=row.id,
        employer_id=row.employer_id,
        job_id=row.job_id,
        effective_on=row.effective_on,
        created_at=row.created_at.isoformat(),
        acknowledged=ack,
        input=row.input,
        result=PayAssessmentResult.model_validate(row.result),
    )


@router.post(
    "/employers/{employer_id}/pay-assessments", response_model=PayAssessmentOut, status_code=201
)
async def create_assessment(
    employer_id: uuid.UUID,
    body: PayAssessmentIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> PayAssessmentOut:
    on = body.effective_on or today_in(body.state)
    if (on - today_in(body.state)).days > 366:
        raise ApiError(422, "effective_date_too_far", "Choose a date within the next year")
    if body.job_id is not None:
        job = await session.get(Job, body.job_id)
        if job is None or job.employer_id != employer_id:
            raise not_found("job")
    row, _result = await run_assessment(session, employer_id, user.id, body, on=on)
    await audit(
        session, user.id, "pay_assessment.created", "pay_assessment", row.id, status=row.status
    )
    return _out(row, await acknowledged(session, employer_id, row.input_hash))


@router.get(
    "/employers/{employer_id}/pay-assessments/{assessment_id}", response_model=PayAssessmentOut
)
async def get_assessment(
    employer_id: uuid.UUID, assessment_id: uuid.UUID, _: Viewer, session: Session
) -> PayAssessmentOut:
    row = await session.scalar(
        select(PayAssessment).where(
            PayAssessment.id == assessment_id, PayAssessment.employer_id == employer_id
        )
    )
    if row is None:
        raise not_found("pay assessment")
    return _out(row, await acknowledged(session, employer_id, row.input_hash))


@router.post(
    "/employers/{employer_id}/pay-assessments/{assessment_id}/acknowledge",
    response_model=PayAssessmentOut,
)
async def acknowledge(
    employer_id: uuid.UUID,
    assessment_id: uuid.UUID,
    body: AcknowledgeIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> PayAssessmentOut:
    row = await session.scalar(
        select(PayAssessment).where(
            PayAssessment.id == assessment_id, PayAssessment.employer_id == employer_id
        )
    )
    if row is None:
        raise not_found("pay assessment")
    if row.status == "below_minimum":
        raise conflict(
            "cannot_acknowledge",
            "Pay below the award minimum can't be acknowledged. Raise the rate.",
        )
    if row.status == "compliant_as_assessed":
        raise conflict("nothing_to_acknowledge", "This pay check does not need a review")
    if not await acknowledged(session, employer_id, row.input_hash):
        # Two concurrent acknowledgements must not fail: the unique key makes the second a no-op.
        stmt = (
            pg_insert(PayAssessmentAcknowledgement)
            .values(assessment_id=row.id, employer_id=employer_id, user_id=user.id, note=body.note)
            .on_conflict_do_nothing(index_elements=["assessment_id"])
        )
        await session.execute(stmt)
        await audit(session, user.id, "pay_assessment.acknowledged", "pay_assessment", row.id)
    return _out(row, True)


# ---- candidate role preferences (private) ----------------------------------------------------
class CandidateRoleIn(BaseModel):
    role_code: str = Field(max_length=12)
    years_experience: int | None = Field(None, ge=0, le=60)
    is_primary: bool = False


class CandidateRolesIn(BaseModel):
    roles: list[CandidateRoleIn] = Field(max_length=8)


class CandidateRoleOut(BaseModel):
    role: RoleOut
    years_experience: int | None
    is_primary: bool


async def _candidate_roles(session: Session, profile_id: uuid.UUID) -> list[CandidateRoleOut]:
    rows = list(
        await session.scalars(
            select(CandidateRole)
            .where(CandidateRole.candidate_id == profile_id)
            .order_by(CandidateRole.is_primary.desc(), CandidateRole.created_at)
        )
    )
    details = {
        r.code: r for r in await search_roles(session, codes=[x.role_code for x in rows], limit=100)
    }
    return [
        CandidateRoleOut(
            role=details[r.role_code], years_experience=r.years_experience, is_primary=r.is_primary
        )
        for r in rows
        if r.role_code in details
    ]


@router.get("/candidate/roles", response_model=list[CandidateRoleOut])
async def my_roles(profile: Candidate, session: Session) -> list[CandidateRoleOut]:
    return await _candidate_roles(session, profile.id)


class RoleSuggestionOut(BaseModel):
    role: RoleOut
    matched_text: str
    mentions: int


@router.get("/candidate/roles/suggestions", response_model=list[RoleSuggestionOut])
async def suggest_roles(
    profile: Candidate, session: Session, resume_id: uuid.UUID | None = None
) -> list[RoleSuggestionOut]:
    """Proposed roles found in the person's own resume text. Nothing is saved until they accept."""
    stmt = select(Resume).where(Resume.candidate_id == profile.id)
    if resume_id is not None:
        stmt = stmt.where(Resume.id == resume_id)
    resumes = list(await session.scalars(stmt))
    if resume_id is not None and not resumes:
        raise not_found("resume")
    text = "\n".join(r.versions[-1].content_text for r in resumes if r.versions)
    if not text.strip():
        return []
    found = await suggest_from_text(session, text)
    mine = {
        r.role_code
        for r in await session.scalars(
            select(CandidateRole).where(CandidateRole.candidate_id == profile.id)
        )
    }
    return [
        RoleSuggestionOut(role=role, matched_text=phrase, mentions=n)
        for role, phrase, n in found
        if role.code not in mine
    ]


@router.put("/candidate/roles", response_model=list[CandidateRoleOut])
async def set_my_roles(
    body: CandidateRolesIn, profile: Candidate, user: CurrentUser, session: Session
) -> list[CandidateRoleOut]:
    codes = [r.role_code for r in body.roles]
    if len(set(codes)) != len(codes):
        raise ApiError(422, "duplicate_role", "Each role can be added once")
    if sum(r.is_primary for r in body.roles) > 1:
        raise ApiError(422, "one_primary", "Choose one main role")
    known = set(
        await session.scalars(
            select(HospitalityRole.code).where(
                HospitalityRole.code.in_(codes), HospitalityRole.status == "active"
            )
        )
    )
    if known != set(codes):
        raise ApiError(422, "unknown_role", "One or more roles don't exist")
    await session.execute(delete(CandidateRole).where(CandidateRole.candidate_id == profile.id))
    for r in body.roles:
        session.add(
            CandidateRole(
                candidate_id=profile.id,
                role_code=r.role_code,
                years_experience=r.years_experience,
                is_primary=r.is_primary,
            )
        )
    await session.flush()
    await audit(session, user.id, "candidate.roles_updated", "candidate", profile.id)
    return await _candidate_roles(session, profile.id)


# ---- administration (privileged) -------------------------------------------------------------
admin = APIRouter(prefix="/v1/admin/awards", tags=["admin"])


class VerifyIn(BaseModel):
    source_note: str = Field(min_length=10, max_length=2000)


class HolidayIn(BaseModel):
    state: str = Field(pattern=r"^(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)$")
    holiday_date: date
    name: str = Field(min_length=2, max_length=120)
    source_url: str = Field(pattern=r"^https://", max_length=500)


@admin.post("/rate-versions/{version_id}/verify")
async def verify_rate(
    version_id: uuid.UUID, body: VerifyIn, user: AdminUser, session: Session
) -> dict[str, str]:
    row = await session.get(AwardRateVersion, version_id)
    if row is None:
        raise not_found("rate version")
    row.data_status, row.verified_by = "verified", user.id
    row.verified_at, row.source_note = datetime.now(UTC), body.source_note
    await audit(session, user.id, "award.rate_verified", "rate_version", row.id)
    return {"id": str(row.id), "data_status": row.data_status}


@admin.post("/penalty-rules/{rule_id}/verify")
async def verify_penalty(
    rule_id: uuid.UUID, body: VerifyIn, user: AdminUser, session: Session
) -> dict[str, str]:
    row = await session.get(PenaltyRuleVersion, rule_id)
    if row is None:
        raise not_found("penalty rule")
    row.data_status, row.verified_by = "verified", user.id
    row.verified_at, row.source_note = datetime.now(UTC), body.source_note
    await audit(session, user.id, "award.penalty_verified", "penalty_rule", row.id)
    return {"id": str(row.id), "data_status": row.data_status}


@admin.get("/rate-versions")
async def list_rate_versions(
    _: AdminUser, session: Session, instrument: AwardCode | None = None
) -> list[dict[str, object]]:
    stmt = (
        select(AwardRateVersion, AwardClassification)
        .join(AwardClassification, AwardClassification.id == AwardRateVersion.classification_id)
        .order_by(AwardClassification.instrument_code, AwardClassification.sort_order)
    )
    if instrument:
        stmt = stmt.where(AwardClassification.instrument_code == instrument)
    return [
        {
            "id": str(rv.id),
            "instrument": c.instrument_code,
            "classification": c.code,
            "effective_from": rv.effective_from.isoformat(),
            "hourly_minor": rv.hourly_minor,
            "data_status": rv.data_status,
        }
        for rv, c in (await session.execute(stmt)).all()
    ]


@admin.post("/public-holidays", status_code=201)
async def add_holiday(body: HolidayIn, user: AdminUser, session: Session) -> dict[str, str]:
    exists = await session.scalar(
        select(PublicHoliday.id).where(
            PublicHoliday.state == body.state, PublicHoliday.holiday_date == body.holiday_date
        )
    )
    if exists:
        raise conflict("holiday_exists", "That holiday is already loaded")
    row = PublicHoliday(**body.model_dump())
    session.add(row)
    await session.flush()
    await audit(session, user.id, "award.holiday_added", "public_holiday", row.id)
    return {"id": str(row.id)}
