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
| Roles | `nua_migrator` (owner, runs Alembic) and `nua_runtime` (DML only, owns nothing) | The startup guard refuses a role that is a superuser, has BYPASSRLS, **or owns or can alter the schema** (fixed in #73). **Before #73 it did not check ownership; an earlier draft of this record said it did, which was wrong.** Neon's default owner role therefore cannot be the runtime role. Roles come from a provider-compatible bootstrap (see the review section). |
| Secrets | Vercel project environment variables, type sensitive | On the API function: **only** the runtime `NUA_DATABASE_URL`, `NUA_JWT_SECRET` and `NUA_ENV`. The migration credential never goes on the function. It lives only in a protected one-off migration run (a CI environment with required reviewers, or an owner-controlled run). No production migrations. Set by the owner in the dashboard; never in chat or the repository. |
| Frontends to API | Server-side calls from the candidate and employer projects | The API is behind Vercel Authentication, so the two frontends need the project's protection-bypass secret sent as a header. Needs a small api-client change. |
| Worker | Vercel Cron to a protected `/internal/...` route | Ingestion fails closed without a source grant (ADR-005), so this can stay off until a grant exists. |
| Email | **Not built** | `NUA_EMAIL_PROVIDER` accepts only `none` or `file` today, and `file` is development-only. A real provider needs a verified-sender adapter, link-based verification and reset, and delivery tests. Public posting and applying stay off until real verified email exists. Choosing a provider is not enough. |

### Why the API stays behind Vercel Authentication
The API itself accepts registration. If it were public, anyone could register by calling it directly
even while every web page said sign-up is closed. Keeping it protected, reachable only by the two
frontends (via the bypass header) and by signed-in team members, keeps "public registration closed"
true at the API, not just in the UI. When the owner opens a pilot, that is a separate, reviewed change.

## Findings from the first builds (8 Nov 2026)
- **Packaging.** Vercel detected the monorepo's Turbo setup, ran `pnpm install` and `turbo run build`,
  and never installed the Python dependencies (`ModuleNotFoundError: fastapi`). An explicit
  `services/api/vercel.json` (install with `uv sync --frozen --no-dev`, no-op build, `syd1`) fixes it:
  the preview build installs the full lockfile and the function now loads the app. Tracked in its own PR.
- **Startup.** With no database connected the app stops in `assert_rls_safe_role`, as designed. That is
  the expected state until the owner steps above are done.
- **Function region not yet confirmed.** The first invocation logged `iad1` before it failed. Re-check
  once the API is healthy; if it is not Sydney, fix before relying on residency.
- **Mobile cannot use the protected setup.** The Android and iOS apps call the API directly from
  devices, and a bypass secret cannot ship inside an app. So Deployment Protection on the API works
  for staging and the web apps only. Before any mobile release the API must be reachable without the
  secret and closed by its own rules: a fail-closed registration switch on the API (so "sign-up
  closed" is true at the API, not just in the UI) is needed first. That is a separate decision and PR.

## Owner review of 8 Nov 2026: corrections and status
The owner's review of this record (comment on #69) found real problems. Each was checked against the
code before changing anything.

| # | Finding | Checked | Status |
| --- | --- | --- | --- |
| 1 | The guard tested only superuser and BYPASSRLS, not table ownership. | Confirmed in `app/db.py`. All 61 RLS tables are `FORCE`d, so an owner cannot read around policies, but an owner can still run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or drop a policy. | **Fixed in #73**: ownership of tables, schema and database (inherited membership included) and `CREATE` on `public` now make the role unsafe. The empty ADR-008 test is now real. |
| 2 | The migration credential must not be on the long-running function. | Agreed. | **Adopted** (Secrets row above). |
| 3 | `db/roles/bootstrap.sql` expects a superuser and runs `ALTER DATABASE ... OWNER`; Neon is managed Postgres. | Confirmed the script's assumptions. Not yet run on Neon. | **Open.** Validate Neon's role-creation and ownership permissions first. If a statement fails, never fall back to a table-owning runtime role. Needs a versioned, idempotent, provider-compatible bootstrap with grants for sequences and default privileges (the local schema has no sequences today; future ones need the grant). |
| 4 | Email is not a dashboard switch. | Confirmed: provider accepts `none`/`file` only. | **Open.** Adapter, flows and delivery tests are a build item. Posting and applying stay off until then. |
| 5 | The protection bypass is powerful. | Agreed. | **Adopted.** Server-only on the candidate and employer projects, never in a bundle, link, log or Git; use a different token from any application-to-API token where practical; verify 401/403 behaviour for unauthorised registration and tenant access. A header alone is never a launch. |
| 6 | Cron is not a worker and is not retried. | Agreed. | **Adopted.** The endpoint is off by default, auth-checked, idempotent, bounded and safe to replay. In-memory rate limits are for isolated staging only; shared Redis before live. |
| 7 | Account snapshot. | Verified 8 Nov: the Neon integration `icfg_4WHdid7INX8UVHuSnBK0RnF6` is installed on the Free plan with **zero** project connections; `nua-crew-api` is protected, has no environment values, and its one READY deployment is not database-backed. | **Confirmed.** No provisioning or payment without the owner's acceptance; the region (Sydney), quote, plan and residency are validated by the owner at creation. |
| 8 | The API must enforce "registration closed" itself (critical). | Confirmed: both register routes were open to any caller. | **Fixed in #74**: `NUA_CANDIDATE_REGISTRATION` and `NUA_EMPLOYER_REGISTRATION` are `closed` (default), `allowlist` or `open`, per role, with `NUA_REGISTRATION_ALLOWLIST` (exact emails or `@domain`). A refusal is `403 registration_closed`, identical for every address. Tests and e2e configs open it explicitly. Which mode staging uses is the owner's setting. Still to prove: a test through the frontend proxy on the hosted stack. |
| 9 | Neon roles. | Owner finding: roles made in the Neon console, CLI or API inherit `neon_superuser` (BYPASSRLS), and `db/roles/bootstrap.sql` is a psql script. | **Open, runbook not yet written.** `nua_runtime` must be created with SQL `CREATE ROLE` (never the console). Whether Neon lets the migrator take database and schema ownership must be tested first. The runtime role must pass the #73 guard on a real Neon start. Never fall back to a table-owning runtime role. |

## Code changes still needed (each its own reviewed PR, with tests)
1. `vercel.json` and entrypoint check for `services/api` (the app is `app/main.py`, a supported
   entrypoint); exclude tests and fixtures from the bundle (500 MB limit).
2. api-client: send the protection-bypass header when `API_PROTECTION_BYPASS` is set (server-side only).
3. Worker as a cron-driven, secret-checked endpoint, off by default.
4. A provider-compatible, idempotent role bootstrap and a protected one-off migration run, validated on Neon before any data is loaded (replaces the single script run by hand).
4a. The ownership guard (#73) and the real verified-email provider adapter (item 4 above).
5. Rate limiting: serverless instances do not share memory, so the in-process limiter is not a real
   limit. Staging may use it with that stated; the first live release needs a shared Redis.

## Owner-only steps (nothing here can be done from the repository)
1. Create the Neon database for staging from the Vercel marketplace (region Sydney) and connect it to
   `nua-crew-api`. Billing and terms are yours to accept.
2. After the Neon permission check below passes, create the two roles with the provider-compatible
   bootstrap, then set **only the runtime** database URL on `nua-crew-api` as a sensitive variable.
   Keep the migration credential out of the Vercel project.
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
