# Implementation tracker

## Current native hiring implementation — 27 October 2026

Branch `feat/native-hire-experience-20261027` extends integrated M3. See `reports/CODEX_NATIVE_HIRE_M4_2026-10-27.md` for implemented mobile employer workflows, UI decisions, evidence and release blockers. Native employer registration, business-scoped job posting and ATS, talent invitations, inbox, venues and membership controls are implemented; integration/device verification remains IN_PROGRESS. Employees remain free nationwide. Billing stays disabled.

## Previous integrated takeover — historical baseline

Branch `feat/integrated-m3-20261027` integrates both local workstreams. Current evidence and outstanding work: `reports/CODEX_INTEGRATION_M3_2026-10-27.md`. Mobile: 180 tests; shared JS: 41 tests; isolated Python: 16 tests; pure availability: 14 tests. New support/verification portal and confirmed-work exclusion constraint: IN_PROGRESS pending real database/browser verification. The targeted DB run failed at connection setup (no PostgreSQL listener), so prior API/e2e counts below are historical. Native employer mode, full shift lifecycle and billing remain unfinished. Employee access free nationwide; no payments or deployment enabled.

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `DONE` · `BLOCKED`. "DONE" means implemented **and** covered by passing tests (evidence column). Last updated 2026-10-27.

Owner direction: Android/iOS first; AI deferred. Latest review: `mobile/CODEX_REVIEW_2026-10-27.md`. Source/test completion does not imply native device or release approval.

## Account and billing addition — 27 October

See `ACCOUNT_BILLING_PLAN.md` for the owner's prices and delivery phases. Draft catalogue plus price/duration calculations: implemented with 13 isolated passing tests. Employee access: free across all Australian states and territories. Employee charging: deferred, removed from the current catalogue and retained only as a future option requiring a fresh owner decision. All products: non-purchasable. Native employer account controls and a read-only planned-price view are implemented in M4. Checkout, ledger/RLS, paid publication expiry, five-slot inventory, refunds and restore: NOT_STARTED. This update does not alter current free development registration or job publication behaviour.

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
| Notifications                                      | IN_PROGRESS | In-app inbox and opt-in Expo adapter implemented; physical push delivery unverified; email/SMS NOT_STARTED                                                     |
| Candidate + employer web UI against real API       | DONE        | `apps/web`, `apps/employer`; `tests/e2e`                                                    |
| Mobile candidate app (Expo, iOS + Android)         | IN_PROGRESS | `apps/mobile`, `docs/mobile/README.md`: 90 Jest tests reverified, 8 earlier browser tests vs real API (not rerun in latest review), Android+iOS bundles compile, prebuild audited. **Not run on a real device/emulator**; store builds need owner accounts |
| Admin portal UI | IN_PROGRESS | M3 support report/verification portal implemented; real database and browser checks blocked. Source/queue management remains API-only. |
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

## M0 — reconcile and stabilise (2026-10-27, local branch `feat/m0-m1-availability-20261027`)

The Codex commits `bfe7fb4` / `97d4f71` were not available; their behaviour was re-implemented and covered by new tests.

| Item                                                                 | Status | Evidence                                                                                                  |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Session generation binding (late refresh, old responses, no replay)  | DONE   | `session-generations.test.ts`, `client.test.ts` (account-change case)                                     |
| Serialised credential writes/deletes; deletion failure reported      | DONE   | `session-generations.test.ts`, `auth-provider.test.tsx` (`credentialsRemoved: false`)                     |
| Private caches cleared on every signed-out event                     | DONE   | `auth-provider.test.tsx` (rejected-refresh case)                                                          |
| Biometric lock armed before restore publishes signed-in              | DONE (code) | Ordering in `AuthProvider`; no device test. Real Face ID / fingerprint behaviour UNVERIFIED            |
| Stable idempotency key on ambiguous retry; double-tap blocked        | DONE   | `apply.test.ts`, `job-detail.test.tsx`                                                                    |
| Keyboard-aware scrollable sheets; usable share links                 | PARTIAL | `Sheet`, `share.test.ts`. Keyboard behaviour on real devices UNVERIFIED                                |
| Fonts/icons: only those used                                         | DONE   | Export 15M → 8.2M, assets 70 → 39, Android hbc 3.71 MB → 3.38 MB                                          |
| RLS tests as a non-superuser, non-BYPASSRLS role; CI bootstrap; guard | DONE  | ADR-008, `db/roles/bootstrap.sql`, `test_rls.py`; 106 API tests under the split roles. CI never run remotely |
| Production runtime role model                                        | PARTIAL | Roles defined; production secrets/rotation/managed Postgres not done                                      |
| Dependency audit                                                     | OPEN   | `pnpm audit --prod` = 2 high, both under `expo > @expo/cli` (tooling, not bundled): `node-forge` (no patched version) and `zod` 3.x (fix only in 4.x). NOT suppressed; the CI gate stays and will fail until Expo ships a fix |
| Redis snapshot / credentials out of git                              | DONE   | `*.rdb`, `appendonly*` ignored; `services/api/dump.rdb` untracked                                         |

## M1 — availability vertical slice (2026-10-27, local branch `feat/m0-m1-availability-20261027`)

Design and privacy decisions: ADR-009. Migration `409867d9e7c2` (up/down/up and backfill tested). Contracts regenerated.

| # | Acceptance item                                                                                   | Status | Evidence                                                                                                  |
| - | ------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| 1 | "Both" overwrites neither set; turning one off keeps its fields and does not touch the other        | DONE   | `test_both_keeps_each_preference_set...`, `test_turning_a_kind_off_withdraws...`; Jest `work-preferences`   |
| 2 | Multiple windows per day, breaks, date exceptions, overnight windows                                | DONE   | `tests/test_availability.py` (pure), `test_weekly_windows_exceptions_and_unknown`; Jest; e2e                |
| 3 | Permanent start date / notice period distinct from being free for a shift tonight                   | DONE   | `test_permanent_start_date_is_separate...`                                                                 |
| 4 | Unavailable exception beats recurring; unknown is labelled unknown, never available                | DONE   | `test_explicit_unavailable_exception...`, `test_no_availability_data_is_unknown...`, talent unknown test     |
| 5 | Confirmed commitments block conflicting bookings; applications alone do not reserve                 | DONE   | `test_confirmed_commitments_conflict_but_applications_do_not_reserve` (service-level lock; no DB exclusion constraint, see ADR-009) |
| 6 | Pay floor, calendar and blocked-employer settings unreadable by employers or other candidates      | DONE   | `test_private_data_is_not_readable...`, `test_results_are_a_privacy_whitelist`, e2e API negatives          |
| 7 | Discovery needs consent, a verified employer and role/tenant checks; completeness opts nobody in    | DONE   | `test_discovery_needs_consent_and_a_verified_member`, route-guard test includes talent routes, e2e         |
| 8 | Prefer / hide / mute behave as documented; no promise of perfect anonymity                          | DONE (hide is best effort by design) | `test_hide_follow_and_mute`; copy in the app                                      |
| 9 | Native forms keep input after validation errors, accessible labels, small screens with keyboard      | PARTIAL | Jest (errors keep values, roles/labels), axe in browser, `Screen`/`Sheet` keyboard avoidance. Real keyboard + TalkBack/VoiceOver UNVERIFIED |
| 10 | APIs, migrations, contracts and native screens agree; downgrade/upgrade and cross-tenant negatives on a real DB | DONE | `test_migrations.py`, `tsc` on all packages, e2e cross-tenant calls |
| - | Employer invitations (needs a real messaging path)                                                  | NOT_STARTED | Page and API say so; no Send button exists                                                       |
| - | `offered` availability state, booking/shifts, DB exclusion constraint for commitments               | NOT_STARTED | Next slices                                                                                              |

## M2 — invitations and consent-based messaging (2026-10-27, local branch `feat/invitations-messaging-20261027`)

Design: ADR-010. Migration `d04d303111e7`. Pricing/billing foundation: `docs/ACCOUNT_BILLING_PLAN.md` (billing NOT enabled). Device checklist: `docs/mobile/DEVICE_TEST_CHECKLIST.md`.

| # | Acceptance case | Status | Evidence |
| - | --- | --- | --- |
| 1 | Verified authorised employer invites a consenting candidate to its own open job | DONE | `test_verified_employer_invites_consenting_candidate_who_accepts_and_chats`, e2e `invitations.spec.ts` |
| 2 | Unverified / suspended-equivalent / unauthorised / cross-tenant fail without leaking | DONE | `test_unverified_unauthorised_and_cross_tenant_requests_fail_without_leaking` (there is no separate "suspended" state: verification revocation is the control) |
| 3 | Consent withdrawn after search blocks the send | DONE | `test_consent_hidden_blocked_paused_and_inactive_all_refuse_with_one_generic_error` |
| 4 | Hidden/blocked preferences block invitations; blocked people are not even found | DONE | same test; `test_removed_member...block` |
| 5 | Opaque references are employer-scoped, expire, and never resolve to account ids | DONE | `test_references_are_employer_scoped_expire_and_cannot_be_guessed` |
| 6 | Duplicate taps, retries and concurrent sends create one pending invitation | DONE | `test_retries_duplicate_taps_and_concurrent_sends_create_one_pending_invitation` |
| 7 | Accept/withdraw/expiry races end in one terminal state | DONE | `test_accept_and_withdraw_race...`, `test_expiry_is_enforced...`, `test_worker_sweep...` |
| 8 | Duplicate accept creates one conversation | DONE | `test_repeat_accept_returns_the_same_conversation` |
| 9 | Pending/declined/expired invitations permit no messaging | DONE | no conversation exists in those states (asserted in the happy-path, decline and expiry tests) |
| 10 | Closed jobs and material changes handled truthfully | DONE | `test_closed_job_and_material_changes_are_handled_truthfully`; Jest `inbox.test.tsx` |
| 11 | Removed members lose the thread immediately | DONE | `test_removed_member_loses_thread_access_immediately_and_block_stops_everything` |
| 12 | Candidate block stops messages and notifications | DONE | same test |
| 13 | Teammates share quotas; several API instances cannot bypass them | PARTIAL | Quotas are counted in Postgres under advisory locks and tested with concurrent requests from two teammates. A true multi-process/multi-instance run was NOT performed |
| 14 | Retried outbox processing does not duplicate effects | PARTIAL | `test_notifications_are_generic_durable_and_pushed_once` (provider failure does not undo or duplicate; at-most-once). A real provider and its retry semantics were not tested; no push credentials |
| 15 | Deep links cannot show a previous account's data | DONE (unit) | Jest: caches cleared on sign-out, other account's id is a 404 screen. Not exercised with a real notification on a device |
| 16 | Export/deletion include the new data without leaking others | DONE | `test_export_and_deletion_cover_invitations_and_threads` |
| 17 | Migration up/down/up and RLS under non-bypass roles | DONE | `test_migrations.py`, `test_rls_isolates_invitations_conversations_and_messages`, route-guard test |
| 18 | Employee access free nationally, no employee SKU | DONE | `tests/test_pricing.py` |
| 19 | Employer estimates A$19 / A$30 / A$49 | DONE | `tests/test_pricing.py` (add-on interpretation unconfirmed) |
| 20 | Native screens: large text, labels, keyboard avoidance, errors | PARTIAL | Jest label/error tests, axe in browser, `Screen`/`Sheet` keyboard avoidance. Real keyboard, large text and screen readers UNVERIFIED (checklist) |
| - | Native employer app and moderation UI implemented in M3/M4 (integration QA pending); email/SMS, attachments, real push | IN_PROGRESS | Named blockers: no device, no push credentials, deferred by directive |

## P3–P6

| Phase                                          | Status                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| P3 Career AI (parse, tailoring, interview)     | DEFERRED by owner                                                                    |
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
