# NUA CREW — Staging Container Runbook
**Date:** 5 November 2026 · **Status:** packaging and CI preparation only. No cloud resources provisioned, no DNS changes, no production database migration, no live billing.

## Topology and ownership
- Existing Vercel `nua-crew-site`: public marketing site, must continue to say products are pre-launch.
- Separate Vercel candidate (`apps/web`) and employer (`apps/employer`) projects: **not deployed or connected to an API yet**. Protect all previews with Vercel SSO and keep registration/billing inactive.
- Backend target: **AWS Sydney (ap-southeast-2)**, separate ECS Fargate services for FastAPI and a continuously running worker; RDS PostgreSQL 16 with pgvector, Redis in private network, private S3 and separately managed ClamAV. Use an AWS budget alert and infrastructure change review **before** any Terraform apply or paid provisioning.
- **One container image** is built using `services/api/Dockerfile`. Default command runs `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers`. The worker ECS task overrides the command with `["python", "-m", "app.worker", "--poll", "10"]`; it runs continuously, not as a once-per-minute function.
- Runs as non-root UID 10001. Its dependencies are installed from the frozen `uv.lock`. The image contains no database secrets or local development fixtures.
- API task: liveness `GET /healthz`; readiness `GET /readyz` checks DB. Do not give the worker the API's HTTP health check; verify worker heartbeat/loop progress separately via logging and a durable last-success metric. Do not expose database, Redis or scanner to the internet.

## Build and uncredentialed smoke tests
From the repository root:
```bash
docker build --pull -t nua-crew-api:local services/api
docker run --rm --entrypoint id nua-crew-api:local -u
docker run --rm --entrypoint python nua-crew-api:local \
  -c "from app.main import create_app; from app.worker import run_once; print(create_app().title)"
```
The `.github/workflows/staging-container.yml` workflow runs these packaging checks on PR/push. **This validates packaging only**, not database connectivity, real API requests, Redis worker persistence, private documents or deployment.

## Mandatory staging environment (secrets in AWS Secrets Manager)
| Setting | Staging requirement |
| --- | --- |
| `NUA_ENV` | `staging` (not development) |
| `NUA_DATABASE_URL` | RDS runtime account; not schema owner, not BYPASSRLS/superuser |
| `NUA_MIGRATION_DATABASE_URL` | Migration-only account, never injected into runtime API/worker |
| `NUA_JWT_SECRET` | Unique strong secret; no dev fallback |
| `NUA_REDIS_URL` | Private Redis endpoint, TLS where required |
| `NUA_CORS_ORIGINS` | JSON list of only verified HTTPS candidate/employer origin URLs, no wildcard |
| `NUA_DOCUMENT_STORAGE` | `disabled` until private S3 + actual ClamAV accepted |
| `NUA_PUSH_PROVIDER` | `none` until provider acceptance |
| `NUA_STRIPE_MODE` | `disabled`, no live or test keys until separate authorised Stripe sandbox step |
| `NUA_PAID_ADVERTISING_ENABLED` | `false` |
| `NUA_BILLING_TERMS_APPROVED` | `false` until legal review |
| `NUA_REQUIRE_ROLE_ON_PUBLISH` | Evaluate with real AU award sources before enabling enforcement |
| `API_BASE_URL` (Vercel) | Approved staging API HTTPS URL, never `localhost` |
| `NUA_SITE_INDEXABLE`/`NUA_PRODUCT_LIVE` (site) | Both `false` until explicit public release approval |

**Do not** place the migrator DSN, AWS admin credentials, Stripe keys or document S3 root keys in Vercel web runtime. Runtime API and worker use separate, minimum-scope credentials and the same application settings; migrations are a separate one-time process with reviewed SQL.

## Database and release safety
1. Validate exact application SHA, migration chain and a single Alembic head. Existing country revision `c55d06a11005` carries lock/validation risks. Pricing PR #33 adds `d66e11cc1006`; do not run either in production just because it was merged.
2. Run read-only preflight on the target: invalid/NULL location countries, row/index estimates, current revision, RLS role grants, backups/PITR, open connections and expected maintenance window.
3. Rehearse upgrade from clean and anonymised older staging snapshots, with backup **and verified restore**. For large tables, review `NOT VALID` + validation and concurrent index strategy **before** applying. Do not rebase migration history already used in shared environments.
4. RLS: runtime role cannot own schema or disable policy. Prove tenant isolation, document IDOR denials and employer membership checks against staging with a real runtime DB role.
5. Once the API has a protected staging URL, smoke test `/healthz`, `/readyz`, job search, blocked NZ publication, full employer/candidate browser flow, worker scheduling, log redaction, restore, metrics and rollback to the prior immutable image digest.

## Release gates
- No cost-bearing AWS apply, DNS, production migrations, live Stripe, public accounts, NZ transactional features or app-store submission are authorised by these files alone.
- Cloud deployment needs an owner-confirmed AWS account, infrastructure budget, exact preview hostnames and secrets entered directly in AWS/Vercel.
- Retain 11 evidence gates from `docs/pilot/readiness.json`. A Docker image build counts as **packaging PASS**, not pilot GO.
