"""Durable ingestion queue on Postgres (ADR-006).

Guarantees: a task survives process crashes (lease + reclaim), is retried with exponential backoff,
lands in the dead-letter state after `max_attempts`, runs at most one-at-a-time per source
(advisory lock), respects a per-source minimum interval, and stops hammering a failing source
(circuit breaker). Every function takes `now` so behaviour is testable without sleeping.
"""

import logging
import time
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import IngestionSource, IngestionTask, Job, JobSourceObservation, SourceFetchRun
from app.rls import set_context
from app.services.ingestion.runner import run_source

log = logging.getLogger("nua.ingestion")

BACKOFF_BASE_S = 30
BACKOFF_CAP_S = 3600
LEASE_S = 300
CIRCUIT_THRESHOLD = 5
CIRCUIT_COOLDOWN_S = 900

# In-process counters for logs; durable counts come from the database (admin stats endpoint).
metrics: Counter[str] = Counter()


def _now() -> datetime:
    return datetime.now(UTC)


def backoff_seconds(attempts: int) -> int:
    return int(min(BACKOFF_CAP_S, BACKOFF_BASE_S * 2 ** max(attempts - 1, 0)))


async def enqueue(
    session: AsyncSession,
    source_id: uuid.UUID,
    *,
    run_after: datetime | None = None,
    idempotency_key: str | None = None,
    max_attempts: int = 5,
) -> uuid.UUID | None:
    """Add a task. With an idempotency key a duplicate is ignored and None is returned."""
    stmt = (
        insert(IngestionTask)
        .values(
            source_id=source_id,
            run_after=run_after or _now(),
            idempotency_key=idempotency_key,
            max_attempts=max_attempts,
        )
        .on_conflict_do_nothing(
            index_elements=[IngestionTask.idempotency_key],
            index_where=IngestionTask.idempotency_key.is_not(None),
        )
        .returning(IngestionTask.id)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def claim(
    session: AsyncSession, worker_id: str, now: datetime | None = None
) -> IngestionTask | None:
    """Lease the next due task. Safe under concurrency (FOR UPDATE SKIP LOCKED).

    A `running` task whose lease expired belongs to a crashed worker and is reclaimed; if it has
    already used its attempts it goes to the dead-letter state instead.
    """
    now = now or _now()
    task = (
        await session.scalars(
            select(IngestionTask)
            .where(
                or_(
                    and_(IngestionTask.status == "queued", IngestionTask.run_after <= now),
                    and_(IngestionTask.status == "running", IngestionTask.locked_until < now),
                )
            )
            .order_by(IngestionTask.run_after)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
    ).one_or_none()
    if task is None:
        return None
    if task.status == "running" and task.attempts >= task.max_attempts:
        task.status, task.finished_at = "dead", now
        task.last_error = "worker lease expired repeatedly"
        task.locked_by = task.locked_until = None
        metrics["dead"] += 1
        return await claim(session, worker_id, now)
    task.status = "running"
    task.attempts += 1
    task.locked_by = worker_id
    task.locked_until = now + timedelta(seconds=LEASE_S)
    return task


@dataclass
class Outcome:
    task_id: uuid.UUID
    # succeeded | rejected | retry | dead | deferred_throttle | deferred_circuit | deferred_busy
    result: str


def _defer(task: IngestionTask, until: datetime) -> None:
    """Put a task back without charging an attempt (throttle/circuit/busy are not failures)."""
    task.status, task.run_after = "queued", until
    task.attempts = max(task.attempts - 1, 0)
    task.locked_by = task.locked_until = None


async def _try_run(
    session: AsyncSession, task_id: uuid.UUID, now: datetime
) -> tuple[str, datetime | None]:
    """Execute one claimed task inside a single transaction; returns (result, retry-at)."""
    await set_context(session, role="system")
    task = await session.get(IngestionTask, task_id)
    assert task is not None  # noqa: S101
    source = await session.get(IngestionSource, task.source_id)
    if source is None:
        task.status, task.finished_at, task.last_error = "dead", now, "source missing"
        return "dead", None

    # One run per source at a time, across all workers.
    got = (
        await session.execute(
            text("SELECT pg_try_advisory_xact_lock(hashtext(:k))"), {"k": f"ingest:{source.id}"}
        )
    ).scalar_one()
    if not got:
        _defer(task, now + timedelta(seconds=5))
        return "deferred_busy", None
    if source.circuit_open_until and source.circuit_open_until > now:
        _defer(task, source.circuit_open_until)
        return "deferred_circuit", None
    if source.last_success_at and now < source.last_success_at + timedelta(
        seconds=source.min_interval_seconds
    ):
        _defer(task, source.last_success_at + timedelta(seconds=source.min_interval_seconds))
        return "deferred_throttle", None

    run = await run_source(session, source, None)
    task.locked_by = task.locked_until = None
    task.finished_at = now
    task.result = {"run_id": str(run.id), "run_status": run.status, **run.stats}
    if run.status == "rejected":
        # Authorisation problems are deterministic: retrying cannot help, and they are not failures.
        task.status, task.last_error = "rejected", run.error
        return "rejected", None
    task.status = "succeeded"
    source.consecutive_failures, source.circuit_open_until = 0, None
    source.last_success_at = now
    return "succeeded", None


async def _record_failure(
    session: AsyncSession, task_id: uuid.UUID, error: Exception, now: datetime
) -> str:
    await set_context(session, role="system")
    task = await session.get(IngestionTask, task_id)
    assert task is not None  # noqa: S101
    source = await session.get(IngestionSource, task.source_id)
    msg = f"{type(error).__name__}: {error}"[:2000]  # never includes record bodies
    task.last_error, task.locked_by, task.locked_until = msg, None, None
    if source is not None:
        source.consecutive_failures += 1
        if source.consecutive_failures >= CIRCUIT_THRESHOLD:
            source.circuit_open_until = now + timedelta(seconds=CIRCUIT_COOLDOWN_S)
        session.add(
            SourceFetchRun(
                source_id=source.id, status="failed", error=msg, finished_at=now, stats={}
            )
        )
    if task.attempts >= task.max_attempts:
        task.status, task.finished_at = "dead", now
        return "dead"
    task.status = "queued"
    task.run_after = now + timedelta(seconds=backoff_seconds(task.attempts))
    return "retry"


async def process_one(
    factory: async_sessionmaker[AsyncSession], worker_id: str, now: datetime | None = None
) -> Outcome | None:
    """Claim and execute a single task. Returns None when nothing is due."""
    now = now or _now()
    async with factory() as s:
        await set_context(s, role="system")
        task = await claim(s, worker_id, now)
        if task is None:
            await s.commit()  # persists any lease-expired task that claim() dead-lettered
            return None
        task_id = task.id
        await s.commit()

    started = time.monotonic()
    try:
        async with factory() as s:
            result, _ = await _try_run(s, task_id, now)
            await s.commit()
    except Exception as exc:  # the whole run rolled back; record why and schedule a retry
        log.warning(
            "ingestion task failed", extra={"task_id": str(task_id), "error": str(exc)[:200]}
        )
        async with factory() as s:
            result = await _record_failure(s, task_id, exc, now)
            await s.commit()
    metrics[result] += 1
    log.info(
        "ingestion task %s", result,
        extra={"task_id": str(task_id), "ms": int((time.monotonic() - started) * 1000)},
    )  # fmt: skip
    return Outcome(task_id, result)


async def schedule_due(session: AsyncSession, now: datetime | None = None) -> int:
    """Enqueue one task per due source per time slot. Multiple schedulers cannot double-enqueue."""
    now = now or _now()
    sources = await session.scalars(
        select(IngestionSource)
        .where(
            IngestionSource.status == "active",
            IngestionSource.schedule_interval_seconds.is_not(None),
            or_(IngestionSource.next_run_at.is_(None), IngestionSource.next_run_at <= now),
        )
        .with_for_update(skip_locked=True)
    )
    count = 0
    for src in list(sources):
        interval = src.schedule_interval_seconds or 0
        slot = int(now.timestamp() // interval)
        if await enqueue(session, src.id, idempotency_key=f"sched:{src.id}:{slot}"):
            count += 1
        src.next_run_at = datetime.fromtimestamp((slot + 1) * interval, UTC)
    return count


async def expire_stale(
    session: AsyncSession, stale_after_seconds: int, now: datetime | None = None
) -> int:
    """Freshness: ingested jobs not re-confirmed by their source within the window are expired."""
    now = now or _now()
    cutoff = now - timedelta(seconds=stale_after_seconds)
    ids = list(
        await session.scalars(
            select(Job.id).where(
                Job.origin == "ingested", Job.status == "published", Job.last_verified_at < cutoff
            )
        )
    )
    if ids:
        await session.execute(update(Job).where(Job.id.in_(ids)).values(status="expired"))
        await session.execute(
            update(JobSourceObservation)
            .where(JobSourceObservation.job_id.in_(ids))
            .values(active=False)
        )
    return len(ids)
