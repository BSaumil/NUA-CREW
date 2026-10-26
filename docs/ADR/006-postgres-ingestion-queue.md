# ADR-006: Postgres-backed ingestion queue (no Celery/broker yet)

**Status:** accepted. Revisit when throughput or fan-out outgrows one database.

**Why Postgres.** Ingestion volume is small and the brief asks to avoid premature distribution. A queue in the same database gives transactional hand-off (a run's jobs, versions and task state commit or roll back together), no new infrastructure to secure, and RLS/audit for free. Redis is used only for rate limiting.

**Mechanics (`app/services/ingestion/queue.py`, `app/worker.py`).**
- `ingestion_tasks` rows with `queued → running → succeeded | rejected | dead`. Claiming uses `FOR UPDATE SKIP LOCKED`, so concurrent workers never receive the same task. A 5-minute lease lets a crashed worker's task be reclaimed; a task that exhausts its attempts that way is dead-lettered.
- **Retries:** exponential backoff (30 s × 2ⁿ, capped at 1 h); after `max_attempts` the task is `dead` (the dead-letter queue). Operators inspect `GET /v1/admin/ingestion/tasks?status=dead` and requeue (audited).
- **Authorisation outcomes are not failures:** a source without a valid permission ends `rejected`, is never retried and does not trip the breaker.
- **Throttling:** per-source `min_interval_seconds` and a Postgres advisory lock allow at most one run per source at a time across all workers. Throttle/circuit/busy deferrals do not consume an attempt.
- **Circuit breaker:** 5 consecutive failures open the circuit for 15 minutes; an operator can reset it.
- **Atomic runs:** a run executes in one transaction; on error everything rolls back (no half-published feed) and a `failed` `source_fetch_runs` row records the error text (never record bodies).
- **Scheduler:** `schedule_due` enqueues one task per source per time slot with an idempotency key, so several schedulers cannot double-enqueue.
- **Freshness:** `expire_stale` expires ingested jobs not re-confirmed by their source within `NUA_INGESTION_STALE_AFTER_SECONDS` (7 days default).
- **Worker:** `python -m app.worker` (loop, graceful SIGTERM) or `--once` (drain and exit, used in CI).

**Not done:** transactional outbox to an embedding queue (no embedding pipeline yet), Prometheus/OTel metrics (in-process counters and log lines only), cross-source dedupe, any network connector.
