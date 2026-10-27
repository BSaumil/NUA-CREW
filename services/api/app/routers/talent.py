"""Employer talent search over consenting candidates (ADR-009). Verified employers only."""

import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.audit import audit
from app.config import get_settings
from app.deps import CurrentUser, Recruiter, Session
from app.errors import forbidden, not_found
from app.models import Employer, Job
from app.ratelimit import get_limiter
from app.schemas import TalentSearchIn, TalentSearchOut
from app.services import talent

router = APIRouter(prefix="/v1/employers", tags=["talent"])


@router.post("/{employer_id}/talent/search", response_model=TalentSearchOut)
async def search_talent(
    employer_id: uuid.UUID,
    body: TalentSearchIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> TalentSearchOut:
    employer = await session.get(Employer, employer_id)
    if employer is None:
        raise not_found("employer")
    if employer.verification_status != "verified":
        raise forbidden("This organisation must be verified before it can search for talent")
    job: Job | None = None
    if body.job_id is not None:
        job = (
            await session.scalars(
                select(Job).where(Job.id == body.job_id, Job.employer_id == employer_id)
            )
        ).one_or_none()
        if job is None:
            raise not_found("job")
    limit = get_settings().talent_search_limit_per_hour
    await get_limiter().check(f"talent-search:{employer_id}", limit, 3600)
    await get_limiter().check(f"talent-search-user:{user.id}", limit, 3600)
    out, shown = await talent.search(session, employer_id, body, job)
    await audit(
        session,
        user.id,
        "talent.search",
        "employer",
        employer_id,
        kind=body.kind,
        job_id=str(body.job_id) if body.job_id else None,
        filters={
            "suburb": body.suburb,
            "state": body.state,
            "skills": len(body.skills),
            "window": bool(body.starts_at),
            "min_weekly_hours": str(body.min_weekly_hours) if body.min_weekly_hours else None,
        },
        shown_candidate_ids=[str(i) for i in shown],  # who an employer saw, for accountability
    )
    return out
