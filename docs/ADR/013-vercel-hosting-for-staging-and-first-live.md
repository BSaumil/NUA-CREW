# ADR-013: Host the API on Vercel for staging and the first live release

**Status:** accepted by the owner on 8 November 2026 ("go ahead with Vercel for now ... hold AWS for
future transitions"). **Supersedes, for now, not deletes:** the AWS Sydney plan in
`infra/aws/` and `docs/operations/AWS_*`. That work stays in the repository, unapplied, as the
route for a later move.

This record decides where the API runs. It does **not** open sign-up, switch on payments, enable New
Zealand, or release the apps. Those stay behind their own gates (end of this file).

## Context
The three web frontends already run on Vercel. The API is a FastAPI app that needs Postgres with
row-level security (ADR-003, ADR-008), Redis for rate limiting, and an ingestion worker. On 8 Nov
2026 no hosted API existed, so the candidate and employer previews could not register, log in or list
jobs (candidate `/jobs` returned 500, `ECONNREFUSED 127.0.0.1:8000`).

## Comparison
Prices are not quotes. Confirm each in the owner's own dashboards before relying on it.

| | AWS Sydney (held) | Vercel + marketplace data (chosen) |
| --- | --- | --- |
| API | Fargate tasks behind a load balancer, always on | FastAPI as Vercel Functions, region `syd1` |
| Postgres | RDS `db.t4g.small` | Neon (already installed on the team, free plan today), region Sydney offered |
| Redis | ElastiCache single node | A marketplace Redis, or the in-process limiter for staging only |
| Worker | Always-on Fargate task | Vercel Cron calling a protected endpoint (needs a small code change) |
| Core cost | about US$172/month of core meters before usage (cost envelope) | Vercel plan plus Neon plus Redis; to be priced in the dashboards |
| Setup effort | Account, OIDC roles, state bucket, plan review, apply | One marketplace database, a handful of environment variables |
| Control | Full | Less: function time limits, cold starts, vendor-managed Postgres |
| Residency | `ap-southeast-2` | Functions `syd1`; database region chosen at creation (pick Sydney) |

Why Vercel now: it is far quicker to a protected staging API, the frontends and API live under one
team and one access model, and the AWS gates (account, roles, quote, state) are all still open.
Why AWS later: an always-on worker, fixed network egress, or Postgres tuning may outgrow serverless.

## Design

| Piece | Where | Notes |
| --- | --- | --- |
| API | Vercel project `nua-crew-api` (`prj_4mX28cYRbGh5HyIfZiUZR5ZEnL1g`), root `services/api`, region `syd1` | Created 8 Nov 2026 with Vercel Authentication on **all** deployment URLs, including production. No deployment and no environment values yet. |
| Database | Neon via the Vercel marketplace, region Sydney | Created by the owner in the dashboard (a purchase decision). Staging first. |
| Roles | `nua_migrator` (owner, runs Alembic) and `nua_runtime` (DML only, not the table owner) | The API **refuses to start** on a role that owns the tables (`assert_rls_safe_role`), so Neon's default owner role cannot be the runtime role. Roles are created by `db/roles/bootstrap.sql`, run once by the owner. |
| Secrets | Vercel project environment variables, type sensitive | `NUA_JWT_SECRET`, the runtime database URL, the migration database URL. Set by the owner in the dashboard. Never in chat or the repository. |
| Frontends to API | Server-side calls from the candidate and employer projects | The API is behind Vercel Authentication, so the two frontends need the project's protection-bypass secret sent as a header. Needs a small api-client change. |
| Worker | Vercel Cron to a protected `/internal/...` route | Ingestion fails closed without a source grant (ADR-005), so this can stay off until a grant exists. |
| Email | Not decided | The verified-email gate needs a real provider before anyone can post or apply. |

### Why the API stays behind Vercel Authentication
The API itself accepts registration. If it were public, anyone could register by calling it directly
even while every web page said sign-up is closed. Keeping it protected, reachable only by the two
frontends (via the bypass header) and by signed-in team members, keeps "public registration closed"
true at the API, not just in the UI. When the owner opens a pilot, that is a separate, reviewed change.

## Code changes still needed (each its own reviewed PR, with tests)
1. `vercel.json` and entrypoint check for `services/api` (the app is `app/main.py`, a supported
   entrypoint); exclude tests and fixtures from the bundle (500 MB limit).
2. api-client: send the protection-bypass header when `API_PROTECTION_BYPASS` is set (server-side only).
3. Worker as a cron-driven, secret-checked endpoint, off by default.
4. A documented one-time migration and role bootstrap the owner runs against the staging database.
5. Rate limiting: serverless instances do not share memory, so the in-process limiter is not a real
   limit. Staging may use it with that stated; the first live release needs a shared Redis.

## Owner-only steps (nothing here can be done from the repository)
1. Create the Neon database for staging from the Vercel marketplace (region Sydney) and connect it to
   `nua-crew-api`. Billing and terms are yours to accept.
2. Run `db/roles/bootstrap.sql` once against it to create the two roles, then set the runtime and
   migration database URLs as sensitive variables.
3. Set `NUA_ENV=staging` and a new random `NUA_JWT_SECRET` as sensitive variables.
4. In `nua-crew-api` settings, create the Protection Bypass for Automation secret, and add it to the
   candidate and employer projects as a sensitive variable.
5. Choose the email provider (needed before any real user can post or apply).

## Gates (unchanged by this decision)
**Staging GO** needs: protected API deployed and healthy, migrations applied through the migration role,
the API started on the runtime role, the frontends connected through the bypass header, and the full
real-gate journey (`pnpm e2e:real-gate`) re-run against that staging stack with real HTTP codes and
logs. Only then is staging "GO", and only for protected access.

**Live GO** additionally needs, each by the owner: an email provider that actually delivers; terms and
privacy links and the pricing wording in the app sign-up; a shared Redis; a paid database plan sized
for live use (free plans are not a live basis); real-device Android and iOS acceptance;
a reviewed production migration; and an explicit decision to open each launch flag. Live Stripe,
public paid posting, document upload and New Zealand transactions stay **off** until separately
approved. Nothing in this record is a GO statement.
