# Runbook (minimal)

- Health: `GET /healthz` (process), `GET /readyz` (DB).
- Reject/stop a source: `POST /v1/admin/ingestion/sources/{id}/takedown`.
- Disable a user: set `users.is_active=false` (API rejects on next request).
- Roll back schema: `alembic downgrade -1` (round-trip is tested).
Production runbooks are not written; no production environment exists.

## Mobile alerts and push

- `make worker` also runs saved-search alerts (≤1 per search per hour) and push delivery. Push is off unless `NUA_PUSH_PROVIDER=expo`.
- A user reports a lost phone: they can "Sign out of all devices"; operators can set `users.is_active=false`.
- Dead push tokens are removed automatically when the provider answers `DeviceNotRegistered`.

## Ingestion queue

- Worker: `make worker` (loop) or `make worker-once`. Stop with SIGTERM; the task in hand finishes first.
- Health: `GET /v1/admin/ingestion/stats` (task counts by status; per-source failures, circuit, last success).
- Dead-letter: `GET /v1/admin/ingestion/tasks?status=dead` → read `last_error` → fix cause → `POST /v1/admin/ingestion/tasks/{id}/requeue`.
- Source tripped its circuit: fix the cause, then `POST /v1/admin/ingestion/sources/{id}/reset-circuit` (or wait 15 min).
- Redis down: rate limiting degrades to per-process windows (logged); sign-in keeps working.
