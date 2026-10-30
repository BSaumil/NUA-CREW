# ADR-008 — Separate migrator and runtime database roles

Status: accepted (2026-10-27). Extends ADR-003.

## Context

ADR-003 makes Postgres row-level security the second wall. RLS is **not applied** to superusers or roles with `BYPASSRLS`, and `FORCE ROW LEVEL SECURITY` only covers the table owner. The Docker and CI databases were created with `POSTGRES_USER`, which is a superuser, so the policy tests could pass while proving nothing about a production-shaped role.

## Decision

- `nua_migrator` owns the schema and runs Alembic. It is never used by the API or worker.
- `nua_runtime` is `NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`, owns nothing, and holds DML grants only (default privileges from the migrator).
- `db/roles/bootstrap.sql` creates both idempotently; Docker (`infra/docker/initdb`) and CI run it. `-v grant_truncate=1` is for test databases only.
- Config: `NUA_DATABASE_URL` is the runtime role; `NUA_MIGRATION_DATABASE_URL` is used by `alembic/env.py` when set.
- Guard: `assert_rls_safe_role()` runs at API and worker start. Outside development it refuses to start on a superuser or BYPASSRLS role; in development it logs a warning. The pytest session exits if the test role bypasses RLS.

## Consequences

- Policy tests now exercise the same role model as production.
- A production deployment still needs its own secret management, credential rotation and managed-Postgres role set-up. That is not done here.
- A migration that adds a table needs no extra grant step (default privileges), but a new table holding tenant data still needs RLS and a policy test.
