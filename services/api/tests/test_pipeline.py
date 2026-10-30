"""Durable ingestion pipeline: queue, retries, dead-letter, throttle, circuit breaker, scheduler."""

import asyncio
import json
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import inspect as sa_inspect

from app.db import get_sessionmaker
from app.models import IngestionSource, IngestionTask
from app.services.ingestion import queue
from app.services.ingestion.queue import (
    claim,
    enqueue,
    expire_stale,
    process_one,
    schedule_due,
)
from app.worker import run_once
from tests.conftest import admin_headers, db_as, register_candidate
from tests.test_ingestion import BASE_RECORDS, FIELDS

pytestmark = pytest.mark.asyncio

T0 = datetime.fromtimestamp(1_800_000_000, UTC)


async def make_source(client, admin, file="feed.json", slug="pipe-feed"):
    r = await client.post(
        "/v1/admin/ingestion/sources",
        json={"slug": slug, "name": "Pipeline feed", "kind": "fixture", "config": {"file": file}},
        headers=admin,
    )
    sid = r.json()["id"]
    r = await client.post(
        f"/v1/admin/ingestion/sources/{sid}/permissions",
        json={
            "legal_basis": "test",
            "license": "test",
            "attribution": "Test",
            "permitted_fields": FIELDS,
        },
        headers=admin,
    )
    assert r.status_code == 201
    return sid


async def schedule(client, admin, sid, interval=None, min_interval=0):
    r = await client.put(
        f"/v1/admin/ingestion/sources/{sid}/schedule",
        json={"interval_seconds": interval, "min_interval_seconds": min_interval},
        headers=admin,
    )
    assert r.status_code == 200, r.text


async def add_task(sid, **kw):
    async with db_as() as s:
        tid = await enqueue(s, uuid.UUID(sid), **kw)
        await s.commit()
    return tid


def snapshot(obj):
    """Plain copy of a row's columns; the ORM instance expires when its session rolls back."""
    return SimpleNamespace(
        **{a.key: getattr(obj, a.key) for a in sa_inspect(obj).mapper.column_attrs}
    )


async def get_task(tid):
    async with db_as() as s:
        return snapshot(await s.get(IngestionTask, tid))


async def get_source(sid):
    async with db_as() as s:
        return snapshot(await s.get(IngestionSource, uuid.UUID(sid)))


async def jobs_total(client):
    return (await client.get("/v1/jobs")).json()["total"]


F = get_sessionmaker  # session factory accessor


async def test_enqueue_is_idempotent_by_key(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    first = await add_task(sid, idempotency_key="slot-1")
    again = await add_task(sid, idempotency_key="slot-1")
    other = await add_task(sid, idempotency_key="slot-2")
    assert first and again is None and other


async def test_successful_task_publishes_jobs_and_updates_source_health(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    tid = await add_task(sid)
    out = await process_one(F(), "w1", T0)
    assert out and out.result == "succeeded" and out.task_id == tid
    t = await get_task(tid)
    assert t.status == "succeeded" and t.attempts == 1 and t.result["created"] == 2
    assert await jobs_total(client) == 2
    src = await get_source(sid)
    assert src.last_success_at == T0 and src.consecutive_failures == 0
    assert await process_one(F(), "w1", T0) is None  # queue drained


async def test_unauthorised_source_is_rejected_not_retried(client, feed):
    admin = await admin_headers(client)
    r = await client.post(
        "/v1/admin/ingestion/sources",
        json={"slug": "no-grant", "name": "x", "kind": "fixture", "config": {"file": "feed.json"}},
        headers=admin,
    )
    tid = await add_task(r.json()["id"])
    out = await process_one(F(), "w1", T0)
    assert out.result == "rejected"
    t = await get_task(tid)
    assert t.status == "rejected" and t.last_error == "no_active_permission"
    assert (await get_source(r.json()["id"])).consecutive_failures == 0  # not a source failure
    assert await jobs_total(client) == 0


async def test_failures_back_off_then_dead_letter_then_operator_requeue(client, feed, tmp_path):
    admin = await admin_headers(client)
    sid = await make_source(client, admin, file="later.json")  # file does not exist yet
    tid = await add_task(sid, max_attempts=2)

    assert (await process_one(F(), "w1", T0)).result == "retry"
    t = await get_task(tid)
    assert t.status == "queued" and t.attempts == 1
    assert t.run_after == T0 + timedelta(seconds=30)
    assert await process_one(F(), "w1", T0 + timedelta(seconds=10)) is None  # backing off

    assert (await process_one(F(), "w1", T0 + timedelta(seconds=31))).result == "dead"
    t = await get_task(tid)
    assert t.status == "dead" and t.attempts == 2 and "FileNotFoundError" in t.last_error
    assert (await get_source(sid)).consecutive_failures == 2
    async with db_as() as s:
        from sqlalchemy import text

        failed = (
            await s.execute(text("select count(*) from source_fetch_runs where status='failed'"))
        ).scalar()
    assert failed == 2

    # operator fixes the cause (publishes the feed file) and requeues from the dead-letter list
    (tmp_path / "later.json").write_text(json.dumps({"records": BASE_RECORDS}))
    listed = (
        await client.get("/v1/admin/ingestion/tasks", params={"status": "dead"}, headers=admin)
    ).json()
    assert [x["id"] for x in listed] == [str(tid)]
    r = await client.post(f"/v1/admin/ingestion/tasks/{tid}/requeue", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "queued" and r.json()["attempts"] == 0
    assert (await process_one(F(), "w1", T0 + timedelta(seconds=40))).result == "succeeded"
    assert (await get_source(sid)).consecutive_failures == 0
    assert (
        await client.post(f"/v1/admin/ingestion/tasks/{tid}/requeue", headers=admin)
    ).status_code == 409


async def test_failed_run_rolls_back_partial_work(client, feed, tmp_path):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    original = queue.run_source

    async def boom(session, source, actor):
        await original(session, source, actor)  # does real work in the transaction...
        raise RuntimeError("connection reset by peer")  # ...then the run dies

    queue.run_source = boom
    try:
        await add_task(sid, max_attempts=1)
        assert (await process_one(F(), "w1", T0)).result == "dead"
    finally:
        queue.run_source = original
    assert await jobs_total(client) == 0  # nothing half-published


async def test_circuit_breaker_stops_hammering_then_recovers(client, feed, tmp_path, monkeypatch):
    monkeypatch.setattr(queue, "CIRCUIT_THRESHOLD", 2)
    monkeypatch.setattr(queue, "CIRCUIT_COOLDOWN_S", 600)
    admin = await admin_headers(client)
    sid = await make_source(client, admin, file="down.json")
    for _ in range(2):
        await add_task(sid, max_attempts=1)
    assert [(await process_one(F(), "w1", T0)).result for _ in range(2)] == ["dead", "dead"]
    src = await get_source(sid)
    assert src.circuit_open_until == T0 + timedelta(seconds=600)

    waiting = await add_task(sid)
    out = await process_one(F(), "w1", T0 + timedelta(seconds=5))
    assert out.result == "deferred_circuit"
    t = await get_task(waiting)
    assert t.status == "queued" and t.attempts == 0 and t.run_after == src.circuit_open_until

    (tmp_path / "down.json").write_text(json.dumps({"records": BASE_RECORDS}))
    assert (await process_one(F(), "w1", T0 + timedelta(seconds=601))).result == "succeeded"
    src = await get_source(sid)
    assert src.consecutive_failures == 0 and src.circuit_open_until is None


async def test_operator_can_reset_circuit(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    async with db_as() as s:
        src = await s.get(IngestionSource, uuid.UUID(sid))
        src.consecutive_failures, src.circuit_open_until = 9, T0 + timedelta(days=1)
        await s.commit()
    r = await client.post(f"/v1/admin/ingestion/sources/{sid}/reset-circuit", headers=admin)
    assert r.json()["consecutive_failures"] == 0 and r.json()["circuit_open_until"] is None


async def test_per_source_min_interval_defers_without_charging_an_attempt(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await schedule(client, admin, sid, min_interval=600)
    await add_task(sid)
    assert (await process_one(F(), "w1", T0)).result == "succeeded"
    second = await add_task(sid)
    out = await process_one(F(), "w1", T0 + timedelta(seconds=10))
    assert out.result == "deferred_throttle"
    t = await get_task(second)
    assert t.attempts == 0 and t.run_after == T0 + timedelta(seconds=600)
    assert (await process_one(F(), "w1", T0 + timedelta(seconds=601))).result == "succeeded"


async def test_crashed_worker_lease_is_reclaimed(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    tid = await add_task(sid)
    async with db_as() as s:  # a worker claims the task and then dies before running it
        assert (await claim(s, "dead-worker", T0)).id == tid
        await s.commit()
    assert await process_one(F(), "w2", T0 + timedelta(seconds=100)) is None  # lease still valid
    out = await process_one(F(), "w2", T0 + timedelta(seconds=301))
    assert out.result == "succeeded"
    t = await get_task(tid)
    assert t.attempts == 2 and t.locked_by is None


async def test_task_that_keeps_killing_workers_is_dead_lettered(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    tid = await add_task(sid, max_attempts=1)
    async with db_as() as s:
        await claim(s, "dead-worker", T0)
        await s.commit()
    assert await process_one(F(), "w2", T0 + timedelta(seconds=301)) is None
    t = await get_task(tid)
    assert t.status == "dead" and "lease expired" in t.last_error


async def test_concurrent_claims_never_hand_out_a_task_twice(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    for i in range(6):
        await add_task(sid, idempotency_key=f"k{i}")

    async def grab(i):
        async with F()() as s:
            from app.rls import set_context

            await set_context(s, role="system")
            t = await claim(s, f"w{i}", T0 + timedelta(seconds=1))
            await s.commit()
            return t.id if t else None

    got = await asyncio.gather(*[grab(i) for i in range(10)])
    claimed = [g for g in got if g]
    assert len(claimed) == 6 and len(set(claimed)) == 6


async def test_workers_serialise_runs_per_source(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await schedule(client, admin, sid, min_interval=0)
    for i in range(3):
        await add_task(sid, idempotency_key=f"k{i}")
    first = await asyncio.gather(*[process_one(F(), f"w{i}", T0) for i in range(3)])
    assert {o.result for o in first} <= {"succeeded", "deferred_busy"}
    assert any(o.result == "succeeded" for o in first)
    for step in range(1, 6):  # busy tasks are retried shortly after
        while await process_one(F(), "w9", T0 + timedelta(seconds=10 * step)):
            pass
    async with db_as() as s:
        statuses = {
            t.status for t in (await s.scalars(__import__("sqlalchemy").select(IngestionTask)))
        }
    assert statuses == {"succeeded"}
    assert await jobs_total(client) == 2  # no duplicate vacancies despite three runs


async def test_scheduler_enqueues_once_per_slot(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await schedule(client, admin, sid, interval=300)
    async with db_as() as s:
        assert await schedule_due(s, T0) == 1
        assert await schedule_due(s, T0) == 0  # not due again
        src = await s.get(IngestionSource, uuid.UUID(sid))
        src.next_run_at = None  # e.g. state lost or a second scheduler racing
        assert await schedule_due(s, T0) == 0  # slot key still blocks a duplicate
        assert await schedule_due(s, T0 + timedelta(seconds=301)) == 1
        await s.commit()


async def test_revoked_sources_are_not_scheduled(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await schedule(client, admin, sid, interval=300)
    await client.post(f"/v1/admin/ingestion/sources/{sid}/takedown", headers=admin)
    async with db_as() as s:
        assert await schedule_due(s, T0) == 0


async def test_stale_ingested_jobs_expire(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await client.post(f"/v1/admin/ingestion/sources/{sid}/run", headers=admin)
    assert await jobs_total(client) == 2
    now = datetime.now(UTC)
    async with db_as() as s:
        assert await expire_stale(s, 3600, now) == 0  # fresh
        assert await expire_stale(s, 3600, now + timedelta(hours=2)) == 2
        await s.commit()
    assert await jobs_total(client) == 0


async def test_worker_pass_schedules_and_drains(client, feed, monkeypatch):
    # Slots are wall-clock aligned, so pin the clock mid-slot: otherwise a minute boundary
    # between the two passes legitimately makes the source due again.
    interval = 60
    pinned = datetime.fromtimestamp(datetime.now(UTC).timestamp() // interval * interval + 30, UTC)
    monkeypatch.setattr(queue, "_now", lambda: pinned)
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    await schedule(client, admin, sid, interval=interval, min_interval=0)
    stats = await run_once()
    assert stats["scheduled"] == 1 and stats["succeeded"] == 1
    assert await jobs_total(client) == 2
    again = await run_once()
    assert again["scheduled"] == 0 and again["succeeded"] == 0


async def test_admin_queue_api_validation_stats_and_access(client, feed):
    admin = await admin_headers(client)
    sid = await make_source(client, admin)
    base = f"/v1/admin/ingestion/sources/{sid}"
    bad = await client.put(f"{base}/schedule", json={"interval_seconds": 30}, headers=admin)
    assert bad.status_code == 422  # sources cannot be polled more than once a minute
    r = await client.post(f"{base}/enqueue", headers=admin)
    assert r.status_code == 202 and r.json()["status"] == "queued"
    await process_one(F(), "w1", T0 + timedelta(days=1))
    stats = (await client.get("/v1/admin/ingestion/stats", headers=admin)).json()
    assert stats["tasks"] == {"succeeded": 1}
    assert stats["sources"][0]["slug"] == "pipe-feed" and stats["sources"][0]["last_success_at"]
    cand = await register_candidate(client, "c@x.example.com")
    for method, url in (
        ("get", "/v1/admin/ingestion/stats"),
        ("get", "/v1/admin/ingestion/tasks"),
        ("post", f"{base}/enqueue"),
        ("put", f"{base}/schedule"),
    ):
        kw = {"json": {}} if method == "put" else {}
        assert (await getattr(client, method)(url, headers=cand, **kw)).status_code == 403
