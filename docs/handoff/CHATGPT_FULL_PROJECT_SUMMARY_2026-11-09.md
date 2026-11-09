# NUA CREW — full project summary for ChatGPT (day 1 → 9 Nov 2026)

Repository `BSaumil/NUA-CREW`, integration branch `main`. This file is a hand-over written by
Claude Code. It states what is **done and evidenced**, what is **left**, and what could come
**next**. It separates facts that are verified in the repository or CI from things that are only
intended. Where something was not verified, it says so. No secret, token or personal data is
included, and none should be added.

## 1. One-paragraph status
NUA CREW is a hospitality-first hiring marketplace for Australia (NZ is preview-only). The code
for the web apps, mobile apps, API, tenant isolation, registration, email verification, job
posting, applications, shifts, pay checks, billing scaffolding and the marketing site is built and
tested in CI. **The hosted stack is not working yet:** the Vercel API returns
`FUNCTION_INVOCATION_FAILED` on every route and none of the API, candidate or employer Vercel
projects has any environment variable. There is no database, Redis or email provider behind it.
**Decision: NO-GO for public launch and NO-GO for hosted pilot acceptance.** Every remaining
blocker is an owner-controlled provider, credential, legal or device decision (section 6).

## 2. Product and stack
| Area | Detail |
| --- | --- |
| Brand | **NUA** master brand, **NUA CREW** product, all caps. Tagline "Where Talent Meets Opportunity". Never HIRIVO/Shiftmate. |
| Apps | `apps/site` marketing (3002), `apps/web` candidate (3000), `apps/employer` employer + `/admin` (3001), `apps/mobile` (Expo, Android/iOS) |
| Packages | `packages/ui` (tokens, launch flags), `packages/api-client`, `packages/contracts` (generated from OpenAPI), `packages/markets` |
| API | `services/api`: FastAPI, SQLAlchemy async/asyncpg, Alembic, Postgres 16 with row-level security, Redis rate limiting, uv/ruff/mypy/pytest |
| Tests | pytest (476 passing locally on 9 Nov), Playwright main suite, a separate **real-gate** suite that drives the shipped CTAs against a real Postgres, mobile jest |
| Hosting decision | ADR-013: Vercel for staging and first live; AWS Sydney Terraform exists as code only (PR #37), never applied |
| Pricing (owner decision 5 Nov) | Employer ad 14 days A$49, optional 5-day promotion A$30, ad + promotion A$79, employees free. Live billing not authorised. |

## 3. Timeline (from git; first commit 26 Oct 2026, 261 commits on `main`)
- **26 Oct** — API foundation, marketplace slice, fail-closed ingestion; candidate and employer web apps and design system; **Postgres RLS tenant isolation**; Redis sliding-window rate limiting; durable ingestion queue/worker with DLQ and circuit breaker.
- **27–28 Oct** — marketing site; native hiring work (M2 invitations, M3/M4); explicit shift offers, atomic acceptance, cancellation, timesheets; Stripe billing tests and setup docs (no live billing).
- **29–30 Oct** — attendance (check-in/out, corrections, no-show); hospitality roles, role-fit and per-day award rate checks; award governance (warn when a rate predates the annual review); mobile attendance screens; interactive app walkthrough.
- **31 Oct–1 Nov** — 24 approved visual concepts; photo-led site; centralised honest SEO metadata and JSON-LD; product pilot readiness (document wallet, shifts, notifications/recovery, pilot evidence tooling).
- **2–4 Nov** — AU/NZ market registry and `/v1/markets` API; nullable `country_code` keys, no blanket backfill; publication and shift hard stops (NZ rejected); award engine tagged AU only; independent launch-gate audit; stabilisation directive.
- **5–6 Nov** — AWS Sydney staging Terraform (zero-credential validate, encrypted locked state, exact account guard, US$300/month conditional cost envelope). Code only, never applied.
- **7–8 Nov (and the days around it; exact dates not re-checked per item)** — award rate verification workflow (#44); Terraform state bootstrap and plan-only role (#47); candidate web account settings, work preferences, availability and employer preferences (#51–#54); password reset and email verification (ADR-012); duplicate/repost job; saved searches/alerts; hospitality role mandatory; ABN required at employer sign-up; new logo and tagline across site, web and mobile; website menu refinement; P0 Stage B hosting audit (#64) and Stage D negative scenarios on shipped gates (#67); registration closed by default with allowlist (#74).
- **9 Nov** — Vercel hosting and protection-bypass header (#70); Neon role bootstrap (#78, rehearsed locally only); transactional email adapter (#81); shared-Redis fail-closed rate limiting (#82); 14-day introductory job ad, closed by default, capped, audited (#83); public web release gate (#84/#85); owner commits for verified-email and Redis auth fail-closed (`f5779d4`); main e2e fix (#77); **hosted pilot acceptance baseline (#88)** and **staging acceptance runner (#89)**.

## 4. What is done (verified in code and CI)
**Identity and access**
- Registration is **closed by default per role**, with an allowlist mode (exact email or `@domain`); open only by explicit flag.
- Email verification and password reset with single-use tokens; verified email is required to post and apply when the gate is active; transactional email via a provider adapter (Resend) that logs no content.
- Role separation: candidate, employer (membership-based), admin. Employers see candidates only through applications and consented talent discovery.
- Employer sign-up requires an ABN with checksum; a checksum is **not** verification — the business stays `unverified` until an admin reviews it.

**Tenant isolation and database safety**
- Postgres RLS on 61 tables with policies and negative tests; identity bound per request; cross-tenant writes only inside `system_scope`; append-only `audit_events` and `application_events`.
- Startup guard refuses to run as a superuser, BYPASSRLS role, schema owner or role that can create in `public`.
- Role model (ADR-008): `nua_migrator` owns the schema, `nua_runtime` is DML-only. `db/roles/neon_bootstrap.sql` and `docs/operations/NEON_ROLE_BOOTSTRAP.md` create them with SQL (not the Neon console, which would grant BYPASSRLS). Rehearsed on a local Postgres 16 with a non-superuser owner; **never run on Neon**.

**Hiring flow**
- Employer: draft, publish (hospitality role mandatory, pay check gate), duplicate, close; applicant review, status changes (rejection needs a reason — a human decision), notes.
- Candidate: profile, work preferences, availability, applications (idempotency key, one active application per job/candidate), saved searches/alerts, account export/delete.
- Introductory 14-day ad: closed by default, advisory-locked caps, audited, no charge; employer UI shows real availability.
- Shifts: offers, atomic acceptance, cancellation, attendance, corrections, timesheets.
- Pay: money in integer cents; award rates are date-versioned and `supplied_unverified` until an admin verifies them; below minimum is a hard block; nothing is invented.

**Markets, safety, abuse**
- AU live-capable only behind flags; NZ is preview-only and rejected at API write schemas, publication, shifts and the award engine.
- Rate limiting is Redis-backed; sensitive scopes (register, forgot, reset, verify, confirm, apply, job-create, uploads) **fail closed** when Redis is down; shared Redis is required outside development.

**Evidence and tooling**
- CI jobs: api, web, dependency-audit, image-build, e2e, e2e-real-gate (plus mobile simulator builds when contracts change). All six reported green on the heads of #88 and #89.
- `docs/pilot/readiness.json` + `pnpm pilot:check <sha>`: 11 gates, all `pending`; the check is intended to keep failing until real evidence and owner approval exist.
- Hosted acceptance baseline (`docs/pilot/HOSTED_ACCEPTANCE_2026-11-09.md`) and the staging acceptance runner (`services/api/scripts/staging_acceptance.py`, runbook `docs/pilot/STAGING_ACCEPTANCE_RUNNER.md`) with hard staging-only guards, honest `blocked` states and a local self-test that passes the full journey.

## 5. Hosted state on 9 Nov 2026 (observed)
| Project | Production deployment | Commit | Result |
| --- | --- | --- | --- |
| nua-crew-api | `dpl_B7W3TkPUWjfqzV1WreNTzCJPbYZu` | `f5779d4` | READY but `/healthz`, `/readyz`, `/v1/jobs` → 500 `FUNCTION_INVOCATION_FAILED` |
| nua-crew-site | `dpl_H3tVPVUFoSDRZxD4GsqoEfbiM2ED` | `f5779d4` | READY |
| nua-crew-employer | `dpl_GxJdwc36QsfifAtbp3MWorumJi6P` | `c157c8a` | READY, login page renders |
| nua-crew-candidate | `dpl_CHFi8EzgS9ENdenQjigajxULFB36` | `c157c8a` | READY, home renders with tagline |
- All four are behind Vercel Authentication. **READY does not mean the API works.**
- API logs: `Application startup failed` in the lifespan, then `ImportError: cannot import name 'vc_handler' from 'vercel_runtime.vc_init'`. The tail of the startup traceback was truncated, so the exact raising line is **unconfirmed**; the likely cause is no database URL (defaults to localhost) failing the role check, and the `vc_handler` error is a possible separate runtime mismatch.
- The API, candidate and employer projects have **no environment variables** (names checked; values never read).
- Region: `vercel.json` requests `syd1`, but API invocations ran in `iad1`/`sfo1`. The web apps' functions did run in Sydney. No Sydney API runtime may be claimed.

## 6. What is left
### 6a. Owner-only (blocks everything hosted)
1. **Database:** create the Sydney Neon staging project; rehearse the role bootstrap on a throwaway branch; run the first migration as `nua_migrator` from a protected context (includes `f88b44ff1008`, intro ad grants). Verify on the real database that the runtime role is non-owner, non-BYPASSRLS.
2. **API environment variables** (sensitive): `NUA_ENV=staging`, `NUA_DATABASE_URL` (the `nua_runtime` URL only), `NUA_JWT_SECRET`, `NUA_CORS_ORIGINS`, `NUA_REDIS_URL`, `NUA_EMAIL_PROVIDER`, `NUA_EMAIL_FROM`, `NUA_EMAIL_API_KEY`. The migration URL must never be on the Vercel project. Asyncpg needs `ssl=require`, not `sslmode`; use the direct (non-pooled) endpoint until the pooler is tested.
3. **Shared Redis** and a **transactional email provider** with a verified sending domain, plus one real delivered message as evidence.
4. **Vercel:** read the API build log for the `vc_handler` error; set the function region to Sydney; decide public domains and protection for candidate and employer; supply `API_PROTECTION_BYPASS` to the web apps only if a protected preview must call a protected API.
5. **Acceptance inputs:** an allowlisted staging host, a synthetic email domain you control, a verification-token source (controlled inbox), and a named admin/verification operator with approved identity.
6. **Legal and commercial:** offer wording, caps and costs for the intro ad; counsel review of terms and privacy; verified award-rate data and a named verifier; NZ legal/tax work before any NZ transaction.
7. **Devices:** real Android and iOS device acceptance (simulators do not count); document storage/virus-scan provider decision.

### 6b. Agent-doable once the stack exists
- Run the staging acceptance runner against the protected staging API and attach the report; extend the hosted negative suite (forced RLS via the `-v post_migration=1` check, missing Redis/email, upload disallowed, invalid redirects).
- Browser E2E on the hosted candidate and employer apps at 320/390/desktop and dark mode, with keyboard and screen-reader name checks and real screenshots.
- Backup/restore and rollback rehearsal; monitoring and alerting wiring; CAPTCHA/WAF choice (needs provider decision).
- Job report/takedown path verification; update `readiness.json` only for gates with linked evidence, a named reviewer, an exact commit and a timestamp.
- Verify the marketing site's automatic Vercel deployment of each merge SHA (not done for `cc0cc7d` and `0923568`).
- Completion report `docs/handoff/CLAUDE_PUBLIC_LAUNCH_COMPLETION_2026-11-09.md` is still unwritten.

### 6c. Still gated or out of scope until explicitly approved
Public registration and job publishing, live Stripe, paid promotions, unscanned document uploads, NZ transactions, native app-store releases, Terraform plan/apply (PR #48 stays security-gated), DNS edits, production migrations and any change to RLS.

## 7. Risks and lessons
- A READY deployment, a green preview bot or a "mergeable" flag is not proof; only GitHub Actions check runs on the exact head SHA count.
- Neon console/CLI roles inherit BYPASSRLS; always create roles with SQL. A non-superuser owner cannot `ALTER ROLE ... NOSUPERUSER`, so verification is a failing check block.
- The email verification token only exists in the mailbox, so a hosted run needs a controlled inbox or token feed; the runner marks that step `blocked` rather than faking it.
- The runner cannot prove RLS, Redis/email absence, redirects or upload scanning through HTTP; those stay `blocked` and prevent a false "accepted".
- Edits to files Prettier reformatted can silently miss when scripted; re-grep after editing.

## 8. Possible next enhancements (after launch gates, in suggested order)
1. Employer onboarding checklist with verification status and an expected-time message.
2. Job-seeker email/push alerts for saved searches (provider-gated), with one-click unsubscribe.
3. Admin console for ABN/business verification, award-rate verification and moderation queues.
4. Reports and takedown workflow for jobs and employers, with SLA tracking.
5. Document vault with virus scanning and retention rules (then allow uploads).
6. Employer analytics (views, applications, time to hire) without ranking or hire probabilities.
7. Interview scheduling and calendar sync; shift-based rosters.
8. Stripe live billing for the A$49 ad and A$30 promotion after owner/tax approval.
9. NZ market: separate legal rule engine, GST/tax review, NZ pay rules, then staged enablement.
10. Observability: structured logs, dashboards and alerting; synthetic uptime checks on `/readyz`.
11. Accessibility pass to WCAG 2.2 AA with automated and manual audits; localisation.
12. Performance: edge caching for public job lists, image budgets, Core Web Vitals baseline.

## 9. How to continue safely (rules)
- Branch off verified `main`; small PRs; merge only when every applicable check is green on the exact head SHA and the expected head SHA is pinned.
- Never commit credentials; never ask for secrets in chat; never weaken RLS; never disable a test to get green.
- Do not flip any public launch flag. `NUA_PRODUCT_LIVE` stays unset.
- Read first: `CLAUDE.md`, `docs/MASTER_BRIEF.md`, `docs/BRAND_IDENTITY.md`, `docs/launch/PUBLIC_WEB_RELEASE_GATE_2026-11-09.md`, `docs/pilot/HOSTED_ACCEPTANCE_2026-11-09.md`, `docs/pilot/STAGING_ACCEPTANCE_RUNNER.md`, `docs/operations/NEON_ROLE_BOOTSTRAP.md`, ADRs 003/008/012/013.
- Suggested first request to Claude once the owner items exist: "Run `staging_acceptance.py` against the staging API and update `HOSTED_ACCEPTANCE_2026-11-09.md` and the matching `readiness.json` gates with the evidence."
