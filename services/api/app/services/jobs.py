import re
import uuid
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import ApiError
from app.models import (
    Employer,
    HospitalityDepartment,
    HospitalityRole,
    Job,
    JobSkill,
    JobVersion,
    Location,
    PayAssessment,
    PublishedPromotion,
    Skill,
)
from app.schemas import JobEmployerOut, JobIn, JobOut, JobRoleOut
from app.services.geo import centroid, haversine_km

_NON_SLUG = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    return _NON_SLUG.sub("-", name.strip().lower()).strip("-")[:100]


async def upsert_skills(session: AsyncSession, names: Iterable[str]) -> list[Skill]:
    by_slug = {slugify(n): n.strip() for n in names if slugify(n)}
    if not by_slug:
        return []
    existing = {
        s.slug: s for s in (await session.scalars(select(Skill).where(Skill.slug.in_(by_slug))))
    }
    for slug, name in by_slug.items():
        if slug not in existing:
            skill = Skill(slug=slug, name=name)
            session.add(skill)
            existing[slug] = skill
    await session.flush()
    return [existing[s] for s in by_slug]


def _snapshot(job: Job, skills: Sequence[str]) -> dict[str, Any]:
    def conv(v: object) -> object:
        if isinstance(v, Decimal):
            return str(v)
        if isinstance(v, datetime | date | uuid.UUID):
            return str(v)
        return v

    cols = (
        "title description status employment_type category suburb state postcode pay_min pay_max "
        "pay_period pay_currency super_included pay_basis apply_url expires_at engagement_basis "
        "duration_type hours_pattern min_weekly_hours max_weekly_hours start_date end_date"
    ).split()
    return {**{c: conv(getattr(job, c)) for c in cols}, "skills": sorted(skills)}


async def record_version(
    session: AsyncSession, job: Job, skills: Sequence[str], actor_id: uuid.UUID | None
) -> None:
    current = await session.scalar(
        select(func.coalesce(func.max(JobVersion.version), 0)).where(JobVersion.job_id == job.id)
    )
    session.add(
        JobVersion(
            job_id=job.id,
            version=(current or 0) + 1,
            snapshot=_snapshot(job, skills),
            created_by=actor_id,
        )
    )


async def set_job_skills(session: AsyncSession, job: Job, names: Iterable[str]) -> list[str]:
    skills = await upsert_skills(session, names)
    existing = {
        js.skill_id: js
        for js in await session.scalars(select(JobSkill).where(JobSkill.job_id == job.id))
    }
    wanted = {s.id for s in skills}
    for sid, js in existing.items():
        if sid not in wanted:
            await session.delete(js)
    for s in skills:
        if s.id not in existing:
            session.add(JobSkill(job_id=job.id, skill_id=s.id, required=True))
    await session.flush()
    return [s.name for s in skills]


def _coords(suburb: str | None, state: str | None) -> tuple[float | None, float | None]:
    c = centroid(suburb, state)
    return (c[0], c[1]) if c else (None, None)


def apply_job_input(job: Job, data: JobIn, location: Location | None) -> None:
    job.title = data.title
    job.description = data.description
    job.employment_type = data.employment_type
    job.category = data.category
    job.location_id = location.id if location else None
    job.suburb = location.suburb if location else None
    job.state = location.state if location else None
    job.postcode = location.postcode if location else None
    job.lat, job.lng = _coords(job.suburb, job.state)
    job.pay_min = data.pay_min
    job.pay_max = data.pay_max
    job.pay_period = data.pay_period if (data.pay_min or data.pay_max) else None
    job.super_included = data.super_included
    # Employers can only declare disclosed pay; "estimated" is reserved for NUA CREW inference.
    job.pay_basis = (
        "disclosed" if (data.pay_min is not None or data.pay_max is not None) else "not_disclosed"
    )
    job.expires_at = data.expires_at
    job.engagement_basis = data.engagement_basis
    job.duration_type = data.duration_type
    job.hours_pattern = data.hours_pattern
    job.min_weekly_hours = data.min_weekly_hours
    job.max_weekly_hours = data.max_weekly_hours
    job.start_date = data.start_date
    job.end_date = data.end_date
    job.role_code = data.role_code
    job.pay_assessment_id = data.pay_assessment_id


def is_open(job: Job, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return job.status == "published" and (job.expires_at is None or job.expires_at > now)


def _distance(origin: tuple[float | None, float | None] | None, j: Job) -> float | None:
    if not origin or origin[0] is None or origin[1] is None or j.lat is None or j.lng is None:
        return None
    return round(haversine_km(origin[0], origin[1], float(j.lat), float(j.lng)), 1)


async def to_out(
    session: AsyncSession,
    jobs: Sequence[Job],
    origin: tuple[float | None, float | None] | None = None,
) -> list[JobOut]:
    if not jobs:
        return []
    ids = [j.id for j in jobs]
    promoted_ids = (
        set(
            await session.scalars(
                select(PublishedPromotion.job_id).where(
                    PublishedPromotion.job_id.in_(ids),
                    PublishedPromotion.active,
                    PublishedPromotion.starts_at <= func.now(),
                    PublishedPromotion.ends_at > func.now(),
                )
            )
        )
        if get_settings().paid_advertising_enabled
        else set()
    )
    skill_rows = await session.execute(
        select(JobSkill.job_id, Skill.name)
        .join(Skill, Skill.id == JobSkill.skill_id)
        .where(JobSkill.job_id.in_(ids))
        .order_by(Skill.name)
    )
    skills: dict[uuid.UUID, list[str]] = {}
    for job_id, name in skill_rows:
        skills.setdefault(job_id, []).append(name)
    role_codes = {j.role_code for j in jobs if j.role_code}
    role_info = {}
    if role_codes:
        for code, title, dcode, dname in await session.execute(
            select(
                HospitalityRole.code,
                HospitalityRole.title,
                HospitalityRole.department_code,
                HospitalityDepartment.name,
            )
            .join(
                HospitalityDepartment, HospitalityDepartment.code == HospitalityRole.department_code
            )
            .where(HospitalityRole.code.in_(role_codes))
        ):
            role_info[code] = JobRoleOut(
                code=code, title=title, department_code=dcode, department_name=dname
            )
    employer_ids = {j.employer_id for j in jobs if j.employer_id}
    employers = {
        e.id: e
        for e in await session.scalars(select(Employer).where(Employer.id.in_(employer_ids)))
    }
    out = []
    for j in jobs:
        emp = employers.get(j.employer_id) if j.employer_id else None
        out.append(
            JobOut(
                promoted=j.id in promoted_ids
                and bool(emp and emp.verification_status == "verified"),
                id=j.id,
                origin=j.origin,
                title=j.title,
                description=j.description,
                status=j.status,
                employment_type=j.employment_type,
                engagement_basis=j.engagement_basis,
                duration_type=j.duration_type,
                hours_pattern=j.hours_pattern,
                min_weekly_hours=j.min_weekly_hours,
                max_weekly_hours=j.max_weekly_hours,
                start_date=j.start_date,
                end_date=j.end_date,
                category=j.category,
                suburb=j.suburb,
                state=j.state,
                postcode=j.postcode,
                pay_min=j.pay_min,
                pay_max=j.pay_max,
                pay_period=j.pay_period,
                pay_currency=j.pay_currency,
                super_included=j.super_included,
                pay_basis=j.pay_basis,
                apply_url=j.apply_url,
                attribution=j.attribution,
                published_at=j.published_at,
                expires_at=j.expires_at,
                last_verified_at=j.last_verified_at,
                skills=skills.get(j.id, []),
                location_id=j.location_id,
                distance_km=_distance(origin, j),
                role=role_info.get(j.role_code) if j.role_code else None,
                pay_assessment_id=j.pay_assessment_id,
                employer=JobEmployerOut(
                    id=emp.id if emp else None,
                    name=emp.name if emp else j.source_employer_name,
                    verification_status=emp.verification_status if emp else None,
                ),
            )
        )
    return out


async def validate_hospitality_links(
    session: AsyncSession, employer_id: uuid.UUID, data: JobIn
) -> None:
    """The role must exist and the pay check must belong to this business (no cross-tenant ids)."""
    if data.role_code is not None:
        role = await session.get(HospitalityRole, data.role_code)
        if role is None or role.status != "active":
            raise ApiError(422, "unknown_role", "That role does not exist")
    if data.pay_assessment_id is not None:
        found = await session.scalar(
            select(PayAssessment.id).where(
                PayAssessment.id == data.pay_assessment_id,
                PayAssessment.employer_id == employer_id,
            )
        )
        if found is None:
            raise ApiError(422, "unknown_pay_assessment", "That pay check does not exist")
    if data.pay_assessment_id is not None and data.role_code is None:
        raise ApiError(422, "role_required", "Choose a role to attach a pay check")
