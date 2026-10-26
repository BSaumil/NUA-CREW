# Implementation tracker

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `DONE` · `BLOCKED`. "DONE" means implemented **and** covered by passing tests (evidence column). Last updated 2026-10-26.

## P0 — bootstrap

| Requirement                                        | Status      | Component / evidence                                                                                                                   |
| -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo (pnpm + Turborepo + uv)                   | DONE        | `package.json`, `turbo.json`, `services/api/pyproject.toml`                                                                            |
| Docs set                                           | IN_PROGRESS | This folder; several documents are deliberately short drafts                                                                           |
| Docker Compose for local dev                       | IN_PROGRESS | `infra/docker/docker-compose.yml` written; **not run** (no Docker daemon in build env)                                                |
| CI skeleton                                        | IN_PROGRESS | `.github/workflows/ci.yml`; **has not run on GitHub yet**                                                                              |
| Alembic migrations (forward/backward)              | DONE        | `tests/test_migrations.py`                                                                                                             |
| Health/readiness                                   | DONE        | `/healthz`, `/readyz`                                                                                                                  |
| Typed API client from OpenAPI                      | DONE        | `packages/contracts` (generated), `packages/api-client` (tests)                                                                        |
| Component library (brand components)               | DONE        | `packages/ui` — 39 tests incl. axe + AA contrast, light/dark                                                                           |
| Storybook / screenshots                            | NOT_STARTED | Components are exercised by vitest + Playwright only                                                                                   |
| Auth: managed OIDC/PKCE + MFA for privileged users | NOT_STARTED | Dev-only local password adapter (ADR-002). Needs an IdP decision                                                                       |
| Terraform/IaC                                      | NOT_STARTED | No cloud provisioning authorised                                                                                                       |

## P1 — marketplace vertical slice

| Requirement                                        | Status      | Evidence                                                                                    |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Employer registration + roles (owner/recruiter/viewer) | DONE    | `test_roles_and_decision_rules`                                                             |
| Employer verification gate before publishing       | DONE        | `test_unverified_employer_cannot_publish`; admin review endpoint audited                    |
| ABN checksum                                       | DONE        | unit test. **Checksum ≠ verification**; no ABR lookup (needs approved source/credentials)   |
| Job CRUD, pay fields, versions, unpublish          | DONE        | API tests + e2e `employer edits a live job…`                                                |
| Candidate profile, skills, resume versions         | DONE        | text resumes only; file upload/malware scan NOT_STARTED                                     |
| Public search (FTS + filters)                      | DONE        | `test_search_only_returns_open_jobs_and_filters`                                            |
| Explainable match estimate                             | DONE        | `test_units.py`; semantic/experience/trajectory reported as "not evaluated"                 |
| One active application per candidate+job           | DONE        | partial unique index; concurrent test                                                       |
| Append-only application/audit history              | DONE        | DB triggers; `test_history_is_append_only_at_db_level`                                      |
| Tenant isolation (guessed IDs)                     | DONE        | `test_employer_tenant_isolation`, `test_candidate_isolation`, e2e                           |
| Postgres RLS (forced) on tenant/private tables     | DONE        | Migration `b1c2d3e4f5a6`; `tests/test_rls.py` (unfiltered SQL per identity, leak test, route guard). Prod must use a non-owner DB role |
| Notifications                                      | IN_PROGRESS | In-app only; email/SMS/push NOT_STARTED                                                     |
| Candidate + employer web UI against real API       | DONE        | `apps/web`, `apps/employer`; `tests/e2e`                                                    |
| Mobile candidate app (Expo, iOS + Android)         | IN_PROGRESS | `apps/mobile`, `docs/mobile/README.md`: 79 Jest tests, 8 browser tests vs real API, Android+iOS bundles compile, prebuild audited. **Not run on a real device/emulator**; store builds need owner accounts |
| Admin portal UI                                    | NOT_STARTED | Admin actions (verification, sources, queue, DLQ, stats) exist as API endpoints only        |
| Data export / in-app account deletion (candidates) | DONE        | `GET /v1/account/export`, `DELETE /v1/account`; `test_account_deletion_*`, mobile settings tests, browser test. Employer-account deletion via support (NOT_STARTED); retention rules need counsel |
| Refresh tokens (rotation, reuse detection, revoke) | DONE        | ADR-007; `test_refresh_*`, `test_logout_*`                                                  |
| Saved jobs, saved searches + alerts, push registry/delivery adapter | DONE | `tests/test_mobile_api.py`. Push provider disabled by default; **no real push sent in any test** |
| Near-me search, pay floor, sort                    | DONE        | `test_near_me_pay_floor_and_sorting`. Coordinates come from an approximate suburb table, not a licensed gazetteer |
| Rate limiting                                      | DONE        | Redis sliding window (atomic Lua) with in-process fallback; auth, application and job-create limits; `tests/test_ratelimit.py` against real Redis. Bot challenges/risk tiers NOT_STARTED |
| Email/phone verification                           | NOT_STARTED |                                                                                             |

## P2 — ingestion and search

| Requirement                                        | Status      | Evidence                                                                                   |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Source registry + permissions, fail-closed         | DONE        | `test_ingestion.py` (no grant, expired grant, missing fields, revoked)                     |
| Fixture connector, repeat-safe, versions, expiry   | DONE        | same                                                                                       |
| Takedown propagation                               | DONE        | `test_revocation_takes_down_and_stops_collector`                                           |
| Markup stripped; injected text inert               | DONE        | `test_injected_listing_stays_unverified_text`                                              |
| SSRF guard                                         | DONE (unit) | `url_guard.py`; no network connector exists yet                                            |
| Durable queue, retries/backoff, DLQ, throttle, circuit breaker, scheduler, worker | DONE | ADR-006; `tests/test_pipeline.py` (17 tests incl. concurrent claims, lease reclaim, rollback on failure). Outbox NOT_STARTED |
| Freshness expiry of stale ingested jobs            | DONE        | `test_stale_ingested_jobs_expire`                                                           |
| LLM normalisation, embeddings, pgvector, hybrid RRF | NOT_STARTED | pgvector not installed locally; migration tolerates its absence                            |
| Cross-source dedupe                                | NOT_STARTED | Identity is currently (source, external_id) only                                           |
| Real licensed feeds / ATS webhooks                 | BLOCKED     | Needs signed licences; none exist                                                          |

## P3–P6

| Phase                                          | Status                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| P3 Career AI (parse, tailoring, interview)     | NOT_STARTED                                                                    |
| P4 NUA CREW Local (shifts, concurrency tests)  | NOT_STARTED — tables not created                                               |
| P5 Billing (Stripe sandbox), trust signals     | NOT_STARTED — `plans/subscriptions/entitlements` not created                   |
| P6 Mobile builds, launch readiness             | NOT_STARTED                                                                    |

## Milestone 1 acceptance (brief §14)

| # | Criterion                                           | Status | Evidence                                                              |
| - | --------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| 1 | Documented single developer command                 | PARTIAL | `make` targets; Docker path untested here                             |
| 2 | Migrations apply, seed works                        | DONE   | `test_migrations`, `app.devseed` run by e2e global setup              |
| 3 | Seeded employer: login, create job, own pipeline    | DONE   | e2e                                                                   |
| 4 | Candidate register/login/profile/search/view        | DONE   | API tests + e2e (registration UI not browser-tested)                  |
| 5 | Exactly one active application, event-backed        | DONE   | API tests + e2e                                                       |
| 6 | Employer advances; candidate sees real status       | DONE   | e2e                                                                   |
| 7 | Cross-tenant/candidate denial with guessed IDs      | DONE   | API tests + e2e                                                       |
| 8 | Unauthorised source blocked; fixture repeat-safe    | DONE   | `test_ingestion.py`                                                   |
| 9 | Backend tests, FE typecheck/lint, one e2e flow      | DONE   | see README for current counts                                         |
| 10| No real payment/external submission/scraping        | DONE   | none implemented                                                      |
