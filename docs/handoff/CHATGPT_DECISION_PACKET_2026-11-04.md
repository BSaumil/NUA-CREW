# Decision packet for ChatGPT — migration go/no-go and deployment target

**Date:** 4 November 2026 · **Repository:** `BSaumil/NUA-CREW` · **`main`:** `f10a55e`
**Purpose:** two decisions only the owner and ChatGPT can settle. Return a clear **GO / NO-GO / GO-WITH-CHANGES** for each, with the evidence listed under "What to return". Claude will implement whatever is decided.

Everything below was read from the repository. Where something is unknown it says so. Nothing here has been run against a production system.

---

## Decision 1 — Production migration `c55d06a11005` (country jurisdictions, from #25)

### Current state
- Merged to `main` via #28 and #29; **not run on any production database**. Alembic has a single head: `c55d06a11005`, parent `a44b95ef1004` (document vault).
- Verified so far only on local and CI databases: `upgrade head`, then `downgrade a44b95ef1004`, then `upgrade head` all clean; API suite 357 tests pass on a fresh database.

### What it does (`services/api/alembic/versions/20261103_c55d06a11005_country_jurisdictions.py`)
1. Adds **nullable** `country_code varchar(2)` to `employers`, `jobs`, `shifts`, `pay_assessments`; adds `ruleset_code varchar(64)` to `pay_assessments`.
2. Adds check constraints `country_code IS NULL OR country_code ~ '^[A-Z]{2}$'` on those four tables.
3. Adds `ck_locations_country_iso`: `locations.country ~ '^[A-Z]{2}$'` on the **existing** `locations` table.
4. Creates index `ix_jobs_country_code` on `jobs(country_code)`.
5. **No backfill.** Existing rows keep `country_code = NULL`.

### Risks to assess (Claude's reading, to be confirmed)
| # | Risk | Why it matters |
| --- | --- | --- |
| 1 | `ck_locations_country_iso` is added as a normal constraint. It scans the whole table and **fails the migration** if any existing `locations.country` is not two uppercase letters | A failure mid-migration on production. Needs a preflight count. Safer form: `NOT VALID` then `VALIDATE CONSTRAINT` |
| 2 | The four new check constraints on `employers`, `jobs`, `shifts`, `pay_assessments` also validate on creation | Brief locks; trivial if the columns are all NULL, but they still take the lock |
| 3 | `create_index` on `jobs` is not `CONCURRENTLY` | Blocks writes to `jobs` while it builds. Fine for a small table, a concern if large |
| 4 | `locations.country` carries a historical `AU` default, so it is **not evidence** of a verified workplace | Already mitigated in code: publishing a job or creating a shift now requires an AU state and four-digit postcode as well (`verified_workplace_country`). Question below |
| 5 | Downgrade drops the new columns | Safe until new rows are written; after that, downgrading **loses** `country_code`/`ruleset_code` values |
| 6 | Runtime role vs migrator role (ADR-008): the API must never run as the schema owner or a superuser (it would bypass row-level security) | The migration must run as the migrator role only |

### Preflight checks to run on production before any approval (read-only)
```sql
-- 1. Would the new constraint fail? Expect 0.
SELECT count(*) FROM locations WHERE country !~ '^[A-Z]{2}$';
-- 2. What countries exist today?
SELECT country, count(*) FROM locations GROUP BY 1 ORDER BY 2 DESC;
-- 3. Table sizes (decides whether a plain CREATE INDEX is acceptable)
SELECT relname, n_live_tup FROM pg_stat_user_tables
 WHERE relname IN ('employers','jobs','shifts','pay_assessments','locations');
-- 4. Existing currency spread on jobs
SELECT pay_currency, count(*) FROM jobs GROUP BY 1;
-- 5. Current Alembic revision (expect a44b95ef1004 before, c55d06a11005 after)
SELECT version_num FROM alembic_version;
```
Also required: a verified backup and a successful restore rehearsal into a scratch database, a maintenance window if sizes are large, and confirmation the migration runs under `NUA_MIGRATION_DATABASE_URL` (migrator role).

### Questions for ChatGPT
1. Should Claude change the migration to `NOT VALID` + `VALIDATE`, and `CREATE INDEX CONCURRENTLY`, before approval? (Claude recommends yes; this needs an Alembic autocommit block for the concurrent index.)
2. Is "AU state + four-digit postcode" enough corroboration for legacy venues, or add an explicit provenance column (`country_source`) to this migration before it ever runs?
3. Is it acceptable that new job/shift `country_code` is written only when the venue is corroborated, with older rows staying NULL indefinitely?
4. What is the rollback rule once new rows exist (restore from backup vs. accept the loss of the two new columns)?

### Go criteria (proposal)
All preflight queries return expected values · backup and restore rehearsed · migration changes from question 1 merged and re-tested · runs as migrator role · owner gives explicit written approval · rollback rule agreed.

---

## Decision 2 — Where the API and apps are deployed

### What exists today
| Component | Evidence | Deployed? |
| --- | --- | --- |
| Marketing site `apps/site` | Vercel project `nua-crew-site`, builds `main`, aliased to `iksaa.com.au` | **Yes** (latest build READY for `f10a55e`) |
| Candidate web `apps/web` (Next.js, port 3000) | Reads `API_BASE_URL` (default `http://localhost:8000`) | No target found |
| Employer web `apps/employer` (Next.js, port 3001) | Same | No target found |
| API `services/api` (FastAPI, `uvicorn app.main:app`) | **No Dockerfile or deploy config in the repo** | No target found |
| Worker (`python -m app.worker`) | Must run on a schedule or continuously | No target found |
| PostgreSQL 16 | Dev compose uses `pgvector/pgvector:pg16`; least-privilege roles via `db/roles/bootstrap.sql` | None for production |
| Redis | Dev compose uses `redis:7-alpine`; `NUA_REDIS_URL` optional | None |
| Mobile (Expo) | `native-builds.yml` makes a debug APK and iOS simulator build in CI only | No store or internal distribution |

Other Vercel projects exist in the same team (`nuasocial`, `nua-website`, `trades-nua`, `mums-cubs`); none were inspected and none appear related to NUA CREW. Earlier owner instructions said not to touch Railway; **Claude does not know whether Railway hosts anything for this product.**

### Requirements the host must meet
- PostgreSQL 16 with two roles: a **runtime** role that is not a superuser and does not bypass row-level security, and a separate **migrator** role (`FORCE RLS` is used; ADR-003/008). Daily backups and a tested restore.
- Region: Australia (S3 default in config is `ap-southeast-2`); confirm data-residency expectations.
- A way to run the API process, the worker, and Redis; TLS; health checks; log redaction.
- Secrets only in the host's secret store. Required settings (names from `services/api/app/config.py`): `NUA_ENV` (not `development`), `NUA_DATABASE_URL`, `NUA_MIGRATION_DATABASE_URL`, `NUA_JWT_SECRET` (the API refuses to start outside development with the dev secret), `NUA_CORS_ORIGINS` (must list the deployed web origins), `NUA_REDIS_URL`; web apps need `API_BASE_URL`.
- Must stay **off**: `NUA_STRIPE_MODE` (disabled), `NUA_PAID_ADVERTISING_ENABLED`, `NUA_DOCUMENT_STORAGE` (disabled until private storage and a scanner exist), `NUA_PUSH_PROVIDER` (none), public registration, site indexing.
- Isolation: staging first, never with production candidate data (`docs/pilot/CONTROLLED_PILOT.md`).

### Options to compare (Claude has not evaluated prices or availability)
| Option | Fits | Open questions |
| --- | --- | --- |
| A. Vercel for the two Next.js apps, plus a managed container host for API/worker and a managed Postgres | Matches the existing Vercel use | Choose the container host and Postgres provider; does it offer an Australian region and RLS-safe roles |
| B. One platform for everything (e.g. a container PaaS with managed Postgres and Redis) | Fewest moving parts | Is any existing Railway account in scope or off-limits |
| C. Cloud provider native (e.g. AWS ap-southeast-2) | Best residency control and S3/ClamAV fit | Highest setup and operations effort |

### Questions for ChatGPT
1. Which option, and which concrete providers, meet the requirements above at an acceptable cost?
2. Is Railway in or out of scope for this product? (Owner said earlier not to touch it.)
3. Staging first: which provider and environment name, and who owns billing and access?
4. Domains: what hostnames for API, candidate web and employer web, and what goes in `NUA_CORS_ORIGINS`?
5. Who runs the worker, and how are Postgres backups and restore rehearsals scheduled?

### What Claude will do once decided
Write the Dockerfile(s) and deploy config, health checks and a staging smoke-test script; run migrations on an empty staging database; wire the web apps to the chosen API URL; run the full browser journey against staging; produce screenshots and an updated launch gate. Claude will **not** create accounts, spend money, enter secrets, or touch production without explicit owner approval.

---

## What to return ("Go-Go" result)
```md
Decision 1 (migration): GO | NO-GO | GO-WITH-CHANGES
  - Required changes to the migration:
  - Preflight results (paste the five query outputs):
  - Rollback rule:
  - Approved by owner (name, date):
Decision 2 (deployment): option chosen, providers, region, staging environment, hostnames
  - CORS origins:
  - Secrets owner / where stored:
  - Railway in or out of scope:
  - Approved by owner (name, date):
```
