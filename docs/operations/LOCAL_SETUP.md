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

Without Docker: create role `nua` and databases `nua_crew`, `nua_crew_test`, `nua_crew_e2e`, then `make test` and `make e2e`.
