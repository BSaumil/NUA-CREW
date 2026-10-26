import uuid
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from app.audit import audit
from app.deps import AdminUser, Session
from app.errors import conflict, not_found
from app.models import Employer, IngestionSource, IngestionTask, SourcePermission
from app.schemas import (
    EmployerOut,
    FetchRunOut,
    IngestionStatsOut,
    PermissionIn,
    ScheduleIn,
    SourceHealthOut,
    SourceIn,
    SourceOut,
    TaskOut,
    VerifyEmployerIn,
)
from app.services.ingestion.queue import enqueue
from app.services.ingestion.runner import run_source, takedown_source

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/employers", response_model=list[EmployerOut])
async def list_employers(
    _: AdminUser, session: Session, status: str | None = None
) -> list[Employer]:
    stmt = select(Employer).order_by(Employer.created_at)
    if status:
        stmt = stmt.where(Employer.verification_status == status)
    return list(await session.scalars(stmt))


@router.post("/employers/{employer_id}/verification", response_model=EmployerOut)
async def verify_employer(
    employer_id: uuid.UUID, body: VerifyEmployerIn, admin: AdminUser, session: Session
) -> Employer:
    """Records a human review outcome. Evidence is mandatory and audited."""
    employer = await session.get(Employer, employer_id)
    if employer is None:
        raise not_found("employer")
    employer.verification_status = body.status
    employer.verification_evidence = body.evidence
    employer.verified_by = admin.id if body.status == "verified" else None
    employer.verified_at = datetime.now(UTC) if body.status == "verified" else None
    await audit(
        session, admin.id, "employer.verification", "employer", employer.id, status=body.status
    )
    await session.flush()
    return employer


@router.post("/ingestion/sources", response_model=SourceOut, status_code=201)
async def create_source(body: SourceIn, admin: AdminUser, session: Session) -> IngestionSource:
    if await session.scalar(select(IngestionSource.id).where(IngestionSource.slug == body.slug)):
        raise conflict("source_exists", "A source with this slug already exists")
    source = IngestionSource(**body.model_dump())
    session.add(source)
    await session.flush()
    await audit(session, admin.id, "ingestion.source_created", "ingestion_source", source.id)
    return source


async def _source(session: Session, source_id: uuid.UUID) -> IngestionSource:
    source = await session.get(IngestionSource, source_id)
    if source is None:
        raise not_found("source")
    return source


@router.post("/ingestion/sources/{source_id}/permissions", status_code=201)
async def grant_permission(
    source_id: uuid.UUID, body: PermissionIn, admin: AdminUser, session: Session
) -> dict[str, str]:
    source = await _source(session, source_id)
    if source.status == "revoked":
        raise conflict("source_revoked", "Revoked sources cannot receive new permissions")
    perm = SourcePermission(source_id=source.id, granted_by=admin.id, **body.model_dump())
    session.add(perm)
    await session.flush()
    await audit(session, admin.id, "ingestion.permission_granted", "ingestion_source", source.id)
    return {"id": str(perm.id)}


@router.post("/ingestion/sources/{source_id}/run")
async def run(source_id: uuid.UUID, admin: AdminUser, session: Session) -> JSONResponse:
    source = await _source(session, source_id)
    result = await run_source(session, source, admin.id)
    body = FetchRunOut.model_validate(result).model_dump(mode="json")
    # A rejected run is recorded (so it can be audited) and surfaced as 403.
    return JSONResponse(body, status_code=403 if result.status == "rejected" else 200)


@router.post("/ingestion/sources/{source_id}/takedown")
async def takedown(source_id: uuid.UUID, admin: AdminUser, session: Session) -> dict[str, int]:
    source = await _source(session, source_id)
    return {"unpublished": await takedown_source(session, source, admin.id)}


@router.put("/ingestion/sources/{source_id}/schedule", response_model=SourceHealthOut)
async def set_schedule(
    source_id: uuid.UUID, body: ScheduleIn, admin: AdminUser, session: Session
) -> IngestionSource:
    source = await _source(session, source_id)
    source.schedule_interval_seconds = body.interval_seconds
    source.min_interval_seconds = body.min_interval_seconds
    source.next_run_at = None
    await audit(
        session, admin.id, "ingestion.schedule_set", "ingestion_source", source.id,
        interval=body.interval_seconds, min_interval=body.min_interval_seconds,
    )  # fmt: skip
    await session.flush()
    return source


@router.post("/ingestion/sources/{source_id}/enqueue", response_model=TaskOut, status_code=202)
async def enqueue_run(source_id: uuid.UUID, admin: AdminUser, session: Session) -> IngestionTask:
    """Queue a run for the worker (retries, throttling and circuit breaking apply)."""
    source = await _source(session, source_id)
    task_id = await enqueue(session, source.id)
    await audit(session, admin.id, "ingestion.enqueued", "ingestion_source", source.id)
    task = await session.get(IngestionTask, task_id)
    assert task is not None  # noqa: S101
    return task


@router.post("/ingestion/sources/{source_id}/reset-circuit", response_model=SourceHealthOut)
async def reset_circuit(
    source_id: uuid.UUID, admin: AdminUser, session: Session
) -> IngestionSource:
    source = await _source(session, source_id)
    source.consecutive_failures, source.circuit_open_until = 0, None
    await audit(session, admin.id, "ingestion.circuit_reset", "ingestion_source", source.id)
    await session.flush()
    return source


@router.get("/ingestion/tasks", response_model=list[TaskOut])
async def list_tasks(
    _: AdminUser,
    session: Session,
    status: str | None = None,
    source_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[IngestionTask]:
    stmt = select(IngestionTask).order_by(IngestionTask.created_at.desc()).limit(min(limit, 200))
    if status:
        stmt = stmt.where(IngestionTask.status == status)
    if source_id:
        stmt = stmt.where(IngestionTask.source_id == source_id)
    return list(await session.scalars(stmt))


@router.post("/ingestion/tasks/{task_id}/requeue", response_model=TaskOut)
async def requeue_task(task_id: uuid.UUID, admin: AdminUser, session: Session) -> IngestionTask:
    """Dead-letter handling: an operator reviews the error, then sends the task round again."""
    task = await session.get(IngestionTask, task_id)
    if task is None:
        raise not_found("task")
    if task.status != "dead":
        raise conflict("not_dead", "Only dead-lettered tasks can be requeued")
    task.status, task.attempts, task.finished_at = "queued", 0, None
    task.run_after = datetime.now(UTC)
    await audit(session, admin.id, "ingestion.requeued", "ingestion_task", task.id)
    await session.flush()
    return task


@router.get("/ingestion/stats", response_model=IngestionStatsOut)
async def ingestion_stats(_: AdminUser, session: Session) -> IngestionStatsOut:
    rows = await session.execute(
        select(IngestionTask.status, func.count()).group_by(IngestionTask.status)
    )
    sources = list(await session.scalars(select(IngestionSource).order_by(IngestionSource.slug)))
    return IngestionStatsOut(
        tasks={k: v for k, v in rows},
        sources=[SourceHealthOut.model_validate(s) for s in sources],
    )
