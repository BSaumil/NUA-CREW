import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import Candidate, Session
from app.errors import ApiError, not_found
from app.models import CandidateSkill, Job, JobSkill, Skill
from app.schemas import JobList, JobOut, MatchOut
from app.services.jobs import is_open, to_out
from app.services.matching import CandidateCtx, JobCtx, compute_match
from app.services.search import SearchParams, Sort, build

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("", response_model=JobList)
async def search_jobs(
    session: Session,
    q: Annotated[str | None, Query(max_length=200)] = None,
    suburb: Annotated[str | None, Query(max_length=100)] = None,
    state: Annotated[str | None, Query(max_length=3)] = None,
    employment_type: str | None = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    skill: Annotated[str | None, Query(max_length=100)] = None,
    min_hourly: Annotated[float | None, Query(ge=0, le=1000)] = None,
    near_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    near_lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float | None, Query(gt=0, le=200)] = None,
    posted_within_days: Annotated[int | None, Query(ge=1, le=90)] = None,
    sort: Sort = "relevance",
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> JobList:
    """Public search over open jobs: full-text, structured filters, pay floor and "near me".

    Coordinates are used for this request only and are never stored or logged.
    """
    if (near_lat is None) != (near_lng is None):
        raise ApiError(422, "near_incomplete", "Provide both near_lat and near_lng")
    if sort == "distance" and near_lat is None:
        raise ApiError(422, "near_required", "sort=distance needs near_lat and near_lng")
    params = SearchParams(
        q=q, suburb=suburb, state=state, employment_type=employment_type, category=category,
        skill=skill, min_hourly=min_hourly, near_lat=near_lat, near_lng=near_lng,
        radius_km=radius_km, posted_within_days=posted_within_days, sort=sort,
    )  # fmt: skip
    stmt, count_stmt = build(params)
    total = await session.scalar(count_stmt) or 0
    jobs = list(await session.scalars(stmt.limit(page_size).offset((page - 1) * page_size)))
    items = await to_out(
        session, jobs, origin=(near_lat, near_lng) if near_lat is not None else None
    )
    return JobList(items=items, total=total, page=page, page_size=page_size)


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
