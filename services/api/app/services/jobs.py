import re
import uuid
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Employer, Job, JobSkill, JobVersion, Location, Skill
from app.schemas import JobEmployerOut, JobIn, JobOut

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
        if isinstance(v, datetime | uuid.UUID):
            return str(v)
        return v

    cols = (
        "title description status employment_type category suburb state postcode pay_min pay_max "
        "pay_period pay_currency super_included pay_basis apply_url expires_at"
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


def apply_job_input(job: Job, data: JobIn, location: Location | None) -> None:
    job.title = data.title
    job.description = data.description
    job.employment_type = data.employment_type
    job.category = data.category
    job.location_id = location.id if location else None
    job.suburb = location.suburb if location else None
    job.state = location.state if location else None
    job.postcode = location.postcode if location else None
    job.pay_min = data.pay_min
    job.pay_max = data.pay_max
    job.pay_period = data.pay_period if (data.pay_min or data.pay_max) else None
    job.super_included = data.super_included
    # Employers can only declare disclosed pay; "estimated" is reserved for NUA CREW inference.
    job.pay_basis = (
        "disclosed" if (data.pay_min is not None or data.pay_max is not None) else "not_disclosed"
    )
    job.expires_at = data.expires_at


def is_open(job: Job, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return job.status == "published" and (job.expires_at is None or job.expires_at > now)


async def to_out(session: AsyncSession, jobs: Sequence[Job]) -> list[JobOut]:
    if not jobs:
        return []
    ids = [j.id for j in jobs]
    skill_rows = await session.execute(
        select(JobSkill.job_id, Skill.name)
        .join(Skill, Skill.id == JobSkill.skill_id)
        .where(JobSkill.job_id.in_(ids))
        .order_by(Skill.name)
    )
    skills: dict[uuid.UUID, list[str]] = {}
    for job_id, name in skill_rows:
        skills.setdefault(job_id, []).append(name)
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
                id=j.id,
                origin=j.origin,
                title=j.title,
                description=j.description,
                status=j.status,
                employment_type=j.employment_type,
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
                employer=JobEmployerOut(
                    id=emp.id if emp else None,
                    name=emp.name if emp else j.source_employer_name,
                    verification_status=emp.verification_status if emp else None,
                ),
            )
        )
    return out
