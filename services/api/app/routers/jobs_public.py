import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.deps import Candidate, Session
from app.errors import not_found
from app.models import CandidateSkill, Job, JobSkill, Skill
from app.schemas import JobList, JobOut, MatchOut
from app.services.jobs import is_open, slugify, to_out
from app.services.matching import CandidateCtx, JobCtx, compute_match

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def _open_filter() -> list[object]:
    return [Job.status == "published", or_(Job.expires_at.is_(None), Job.expires_at > func.now())]


@router.get("", response_model=JobList)
async def search_jobs(
    session: Session,
    q: Annotated[str | None, Query(max_length=200)] = None,
    suburb: Annotated[str | None, Query(max_length=100)] = None,
    state: Annotated[str | None, Query(max_length=3)] = None,
    employment_type: str | None = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    skill: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> JobList:
    """Public search over open jobs (Postgres full-text + structured filters)."""
    where = _open_filter()
    if suburb:
        where.append(func.lower(Job.suburb) == suburb.lower())
    if state:
        where.append(Job.state == state.upper())
    if employment_type:
        where.append(Job.employment_type == employment_type)
    if category:
        where.append(func.lower(Job.category) == category.lower())
    if skill:
        where.append(
            Job.id.in_(
                select(JobSkill.job_id)
                .join(Skill, Skill.id == JobSkill.skill_id)
                .where(Skill.slug == slugify(skill))
            )
        )
    stmt = select(Job).where(*where)  # type: ignore[arg-type]
    count_stmt = select(func.count()).select_from(Job).where(*where)  # type: ignore[arg-type]
    if q and q.strip():
        tsq = func.websearch_to_tsquery("english", q)
        stmt = stmt.where(Job.search_vector.op("@@")(tsq)).order_by(
            func.ts_rank_cd(Job.search_vector, tsq).desc(), Job.published_at.desc()
        )
        count_stmt = count_stmt.where(Job.search_vector.op("@@")(tsq))
    else:
        stmt = stmt.order_by(Job.published_at.desc().nulls_last(), Job.id)
    total = await session.scalar(count_stmt) or 0
    jobs = list(await session.scalars(stmt.limit(page_size).offset((page - 1) * page_size)))
    return JobList(items=await to_out(session, jobs), total=total, page=page, page_size=page_size)


async def _open_job(session: Session, job_id: uuid.UUID) -> Job:
    job = await session.get(Job, job_id)
    if job is None or not is_open(job):
        raise not_found("job")
    return job


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: uuid.UUID, session: Session) -> JobOut:
    job = await _open_job(session, job_id)
    return (await to_out(session, [job]))[0]


@router.get("/{job_id}/match", response_model=MatchOut)
async def match(job_id: uuid.UUID, candidate: Candidate, session: Session) -> MatchOut:
    job = await _open_job(session, job_id)
    job_skills = {
        n
        for n in await session.scalars(
            select(Skill.name)
            .join(JobSkill, JobSkill.skill_id == Skill.id)
            .where(JobSkill.job_id == job.id)
        )
    }
    cand_skills = {
        n
        for n in await session.scalars(
            select(Skill.name)
            .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
            .where(CandidateSkill.candidate_id == candidate.id)
        )
    }
    job_l, cand_l = {x.lower() for x in job_skills}, {x.lower() for x in cand_skills}
    result = compute_match(
        JobCtx(
            job_l,
            job.employment_type,
            job.suburb,
            job.state,
            job.postcode,
            job.pay_max,
            job.pay_period,
            job.pay_basis,
        ),
        CandidateCtx(
            cand_l,
            list(candidate.preferred_employment_types),
            candidate.suburb,
            candidate.state,
            candidate.postcode,
            candidate.min_hourly_pay,
        ),
    )
    display = {n.lower(): n for n in job_skills}
    return MatchOut(
        job_id=job.id,
        estimate=result.estimate,
        gates=[{"key": "job_open", "passed": True, "reason": "Job is open for applications"}],
        components=result.components,
        missing_skills=[display[s] for s in result.missing_skills],
    )
