import uuid

from fastapi import APIRouter, Response
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.audit import audit
from app.deps import Candidate, CurrentUser, Session
from app.errors import conflict, not_found
from app.models import CandidateProfile, DeviceToken, Job, SavedJob, SavedSearch
from app.rls import system_scope
from app.schemas import (
    DeviceIn,
    NotificationSettingsIn,
    ProfileOut,
    SavedJobOut,
    SavedSearchIn,
    SavedSearchOut,
    SavedSearchPatch,
)
from app.services.jobs import is_open, to_out

router = APIRouter(tags=["mobile"])
MAX_SAVED_SEARCHES = 20


# ---- saved jobs ----
@router.get("/v1/candidate/saved-jobs", response_model=list[SavedJobOut])
async def list_saved_jobs(candidate: Candidate, session: Session) -> list[SavedJobOut]:
    rows = (
        await session.execute(
            select(SavedJob, Job)
            .join(Job, Job.id == SavedJob.job_id)
            .where(SavedJob.candidate_id == candidate.id)
            .order_by(SavedJob.created_at.desc())
            .limit(200)
        )
    ).all()
    outs = {o.id: o for o in await to_out(session, [j for _, j in rows])}
    return [SavedJobOut(job=outs[j.id], saved_at=s.created_at, is_open=is_open(j)) for s, j in rows]


@router.get("/v1/candidate/saved-jobs/ids", response_model=list[uuid.UUID])
async def saved_job_ids(candidate: Candidate, session: Session) -> list[uuid.UUID]:
    """Lightweight list so clients can draw the heart on search results."""
    return list(
        await session.scalars(select(SavedJob.job_id).where(SavedJob.candidate_id == candidate.id))
    )


@router.put("/v1/candidate/saved-jobs/{job_id}", status_code=204)
async def save_job(job_id: uuid.UUID, candidate: Candidate, session: Session) -> Response:
    job = await session.get(Job, job_id)
    if job is None:  # drafts are invisible to candidates under RLS, so they look missing too
        raise not_found("job")
    await session.execute(
        insert(SavedJob)
        .values(candidate_id=candidate.id, job_id=job_id)
        .on_conflict_do_nothing(index_elements=["candidate_id", "job_id"])
    )
    return Response(status_code=204)


@router.delete("/v1/candidate/saved-jobs/{job_id}", status_code=204)
async def unsave_job(job_id: uuid.UUID, candidate: Candidate, session: Session) -> Response:
    row = await session.get(SavedJob, (candidate.id, job_id))
    if row is not None:
        await session.delete(row)
    return Response(status_code=204)


# ---- saved searches / alerts ----
def _search_out(s: SavedSearch) -> SavedSearchOut:
    return SavedSearchOut(
        id=s.id, name=s.name, params=s.params, alerts_enabled=s.alerts_enabled,
        last_alerted_at=s.last_alerted_at, created_at=s.created_at,
    )  # fmt: skip


@router.get("/v1/candidate/saved-searches", response_model=list[SavedSearchOut])
async def list_saved_searches(candidate: Candidate, session: Session) -> list[SavedSearchOut]:
    rows = await session.scalars(
        select(SavedSearch)
        .where(SavedSearch.candidate_id == candidate.id)
        .order_by(SavedSearch.created_at.desc())
    )
    return [_search_out(s) for s in rows]


@router.post("/v1/candidate/saved-searches", response_model=SavedSearchOut, status_code=201)
async def create_saved_search(
    body: SavedSearchIn, candidate: Candidate, user: CurrentUser, session: Session
) -> SavedSearchOut:
    count = await session.scalar(
        select(func.count())
        .select_from(SavedSearch)
        .where(SavedSearch.candidate_id == candidate.id)
    )
    if (count or 0) >= MAX_SAVED_SEARCHES:
        raise conflict("too_many_searches", f"You can save up to {MAX_SAVED_SEARCHES} searches")
    s = SavedSearch(
        candidate_id=candidate.id,
        name=body.name,
        params=body.params.model_dump(exclude_none=True),
        alerts_enabled=body.alerts_enabled,
        # Alerts only cover jobs published after the search was saved.
        last_alerted_at=func.now(),
    )
    session.add(s)
    await session.flush()
    await session.refresh(s)
    return _search_out(s)


async def _own_search(session: Session, candidate: CandidateProfile, sid: uuid.UUID) -> SavedSearch:
    s = (
        await session.scalars(
            select(SavedSearch).where(
                SavedSearch.id == sid, SavedSearch.candidate_id == candidate.id
            )
        )
    ).one_or_none()
    if s is None:
        raise not_found("saved search")
    return s


@router.patch("/v1/candidate/saved-searches/{search_id}", response_model=SavedSearchOut)
async def patch_saved_search(
    search_id: uuid.UUID, body: SavedSearchPatch, candidate: Candidate, session: Session
) -> SavedSearchOut:
    s = await _own_search(session, candidate, search_id)
    if body.name is not None:
        s.name = body.name
    if body.alerts_enabled is not None:
        s.alerts_enabled = body.alerts_enabled
    await session.flush()
    return _search_out(s)


@router.delete("/v1/candidate/saved-searches/{search_id}", status_code=204)
async def delete_saved_search(
    search_id: uuid.UUID, candidate: Candidate, session: Session
) -> Response:
    await session.delete(await _own_search(session, candidate, search_id))
    return Response(status_code=204)


# ---- push devices and notification settings ----
@router.post("/v1/devices", status_code=204)
async def register_device(body: DeviceIn, user: CurrentUser, session: Session) -> Response:
    """Upsert a push token. If the phone changed hands, the token follows the latest sign-in."""
    stmt = insert(DeviceToken).values(user_id=user.id, token=body.token, platform=body.platform)
    # Taking over a token from a previous account is a cross-user write, so it runs in system scope.
    async with system_scope(session):
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=["token"],
                set_={"user_id": user.id, "platform": body.platform, "last_seen_at": func.now()},
            )
        )
    return Response(status_code=204)


@router.delete("/v1/devices", status_code=204)
async def unregister_device(body: DeviceIn, user: CurrentUser, session: Session) -> Response:
    row = (
        await session.scalars(
            select(DeviceToken).where(
                DeviceToken.token == body.token, DeviceToken.user_id == user.id
            )
        )
    ).one_or_none()
    if row is not None:
        await session.delete(row)
    return Response(status_code=204)


@router.put("/v1/candidate/notification-settings", response_model=ProfileOut)
async def notification_settings(
    body: NotificationSettingsIn, candidate: Candidate, user: CurrentUser, session: Session
) -> ProfileOut:
    candidate.push_enabled = body.push_enabled
    await audit(
        session, user.id, "notifications.push_toggle", "user", user.id, enabled=body.push_enabled
    )
    await session.flush()
    return ProfileOut.model_validate(candidate)


__all__ = ["router"]
