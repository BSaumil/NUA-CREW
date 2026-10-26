# Runbook (minimal)

- Health: `GET /healthz` (process), `GET /readyz` (DB).
- Reject/stop a source: `POST /v1/admin/ingestion/sources/{id}/takedown`.
- Disable a user: set `users.is_active=false` (API rejects on next request).
- Roll back schema: `alembic downgrade -1` (round-trip is tested).
Production runbooks are not written; no production environment exists.
