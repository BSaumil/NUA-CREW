# Local setup

Prereqs: Node 22, pnpm 10, uv, PostgreSQL 16 (or Docker). Optional: pgvector.

```bash
make install
make db-up                       # Docker path (untested in the build environment), or use any Postgres 16
cp .env.example .env
make migrate && make seed        # seed = fictional dev data; refuses to run unless NUA_ENV=development
make api                         # :8000
make web                         # :3000
make employer                    # :3001
```

Dev logins (password `nua-dev-password-1`): `owner-a@nua-crew.example.com` (verified employer), `viewer-a@…`, `recruiter-a@…`, `candidate-a@…`, `owner-b@…`, `candidate-b@…`, `admin@…` (all `@nua-crew.example.com`).

Mobile app: see `docs/mobile/README.md` (`cd apps/mobile && pnpm start`).

Without Docker: create databases `nua_crew`, `nua_crew_test`, `nua_crew_e2e`, then run the role bootstrap on each as a superuser (ADR-008):

```bash
psql -d nua_crew_test -v ON_ERROR_STOP=1 -v migrator_password=nua_migrator_dev -v runtime_password=nua_runtime_dev \
  -v grant_truncate=1 -f db/roles/bootstrap.sql   # grant_truncate only for test databases
```

The API uses `NUA_DATABASE_URL` (role `nua_runtime`, subject to RLS); Alembic uses `NUA_MIGRATION_DATABASE_URL` (role `nua_migrator`). The API refuses to start on a superuser/BYPASSRLS role outside development. Then `make test` and `make e2e`.
