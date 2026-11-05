# NUA CREW — Launch Stabilisation Execution Directive
**Date:** 4 November 2026 (Australia/Melbourne)
**Owner approval:** Proceed with launch stabilisation and pre-release QA. **This is not permission to activate live billing, migrate a production database, publish app-store builds, or open public accounts.**
**Coordination branch:** `chore/launch-stabilisation-20261104` (documentation only; do not base product changes on an unreviewed documentation PR).
**Release candidate baseline:** `main` at `f10a55e817a0af2681fd8cccb73ba3c105d8ad01`.

## Commercial addendum (5 November 2026)

The owner revised the draft employer advertisement price to A$49 for 14 days; the A$30 five-day promotion is unchanged, so the bundle is A$79. Draft PR #33 implements the catalogue, DB constraint and tests. This directive does not enable billing and must not be treated as evidence that PR #33 is merged or live.

## Verified repository state — do not repeat completed work
- PR #27 cross-platform AU/NZ preview UI merged.
- PR #28 merged the previously overlapping backend PRs #25 and #26: read-only market endpoints, conservative AU/NZ contracts, nullable jurisdiction migration and verified-workplace gate. Merge commit `bb930e829500fd567dc9fc1bcbd32329f84ca9e5`. Its PR head `6444d3a9350942fe70f7e83215d3af6efde535df` passed GitHub CI run `41600879999`.
- PR #29 integrated the old document-wallet/workspace/pilot branch #11: merged at `f10a55e817a0af2681fd8cccb73ba3c105d8ad01`. Its PR head `ef8b6d7f67929a7bb3064a36be936a528df5c517` passed CI run `41605820811` and native-build-validation `41605820854`. Those runs validate their exact PR head, **not** production or physical devices.
- PRs #11, #25 and #26 are now closed via integration. Do not try to merge them again. Review merged code directly.
- GitHub repository default branch is still `claude/new-session-kszaxl`, substantially behind `main`. **Explicitly fetch and use `main`.** Coordinate changing the GitHub default branch to `main` with repository admin; don't force-push or delete history.
- The current `docs/pilot/readiness.json` contains **11 pending gates**. Neither merged code nor Vercel-success status establishes pilot readiness.
- Australia is the first controlled-pilot market. New Zealand remains **preview-only / disabled for transactions**. Country capabilities, price displays, terms and launch status must remain honest.

## Mission and working rules
Deliver a fully integrated, **testable** NUA CREW release candidate for an invitation-only, Melbourne-led Australian pilot. Employees remain free. Employer products are A$49 / 14-day advertisement, A$30 / 5-day promotion add-on and A$79 combined **in Stripe sandbox only** until separate commercial approval. Maintain NUA CREW under NUA POS business identity without inventing ABN/NZBN details; do not expose a founder's personal name in the public site. Retain NUA CREW brand, accessible ivory/burgundy identity and a clean, image-led site without old banner artwork. Do not resurrect deprecated AI marketing copy.

**Ownership split:** Claude Code owns ~90–95% of implementation, defect remediation, automation, manual setup documentation, test evidence, and PR delivery. ChatGPT owns independent final review, UX/copy refinement and release-gate assessment. Avoid duplicate parallel edits.

- Feature freeze: no discretionary features. Exceptions: P0 security, integrity, onboarding usability, operational support, and testability defects blocking the pilot.
- Start every task with `git fetch --all --prune`, inspect `origin/main` and all relevant open branches, record exact baseline SHA and change owner. Work from current `main`, not the repository's stale default branch. Use short-lived PR branches, no direct commits to `main`.
- Production data, deployment aliases, public registrations, site indexing, live payments, store submissions and NZ job flows remain off. Never run a production schema migration without a separate owner-approved change plan and rollback.
- Never weaken FORCE RLS, tenant checks, employer membership or candidate consent. Never trust client-supplied employer/business/country IDs; never add fallback credentials or log secrets. Don't use real candidate documents in CI.
- Do not claim verified wages until current Fair Work source, classification, effective dates, weekends/holidays and review evidence are established. Do not use AU awards for NZ.
- Evidence must name the exact commit, workflow URL, environment and whether the result is mocked, browser-simulated, native simulator or real device. Do not mark a gate passed based on implementation alone.

## Phase S0 — Baseline and red/green CI (P0, start immediately)
**Claude deliverables**
1. Verify `origin/main` SHA, working tree, migration head, OpenAPI generated-contract drift, test scripts, package lock, branch topology and outstanding GitHub PRs; update stale status references from older plans.
2. Request admin correction of repository default branch from `claude/new-session-kszaxl` to `main`. Confirm CI, PR base settings and branch protections; **do not rewrite stale branch history**.
3. Validate **fresh** GitHub Actions on an exact post-integration SHA: API `ruff`, `mypy`, Postgres/pgvector/Redis pytest with non-BYPASSRLS runtime role, JS lint/typecheck/tests/build, contracts regeneration and diff, dependency audits, browser Playwright E2E and native Android/iOS Hermes bundles. Investigate failures rather than suppressing them.
4. Test migration `base -> head`, upgrade/downgrade where safe, and snapshot/rollback rehearsal on an **isolated database**. Confirm one Alembic head, document-vault then jurisdiction sequencing, no production backfill, and existing AU data compatibility.
5. Produce `docs/reports/LAUNCH_STABILISATION_BASELINE_2026-11-04.md`: SHA, runs, test counts, defects with severity, external blockers, reproducible commands and Vercel preview/staging URLs (only verified URLs).

**Done when:** exact-main CI success evidence is attached, blocking failures are triaged and documented, and the repository has one unambiguous release source.

## Phase S1 — Security, data integrity, and hiring acceptance (P0)
Implement and exercise the **full cross-platform hiring journey** against real isolated PostgreSQL with RLS, not only mocked transport:
- Candidate signs up, recovers account, completes profile, uploads/chooses documents only when infrastructure is approved, searches jobs, applies and withdraws.
- Employer signs up, verifies appropriate AU ABN/business authority, creates venue, uses role/classification/pay guide, publishes eligible job, reviews applications, invites, messages, decides and closes job.
- Invitation-only temporary shift: request/offer, availability conflicts, accept/decline, cancellation/no-show, check-in/out, corrected timesheet and immutable history.
- Negative security tests for unrelated employer, candidate, recruiter/viewer role, document IDOR, guessing IDs, switching accounts, expired tokens, stale sessions, concurrent bookings, duplicate form submission, replayed signed events and RLS.
- Jurisdiction tests: AU venue proof required; reject unverifiable AU country provenance; reject NZ/unknown publication, NZ pay through AU calculator, currency mismatch and tenant/country privilege escalation. Keep historical ambiguous records unresolved until evidence reviewed.
- API and generated TypeScript clients + web/native source must match. Prevent duplicated entitlements, double bookings and silently lost changes.
- Add accessible error recovery, honest empty states, idempotent retries and useful inline context. No synthetic green successes.

**Done when:** independently reproducible end-to-end browser/API tests and security-negative cases pass at a recorded SHA; native device work follows separately.

## Phase S2 — Identity, privacy, document infrastructure (P0)
- Select/implement approved managed production-grade identity with account recovery, role re-verification, privileged MFA, session revocation, company owner transfer, business closure and candidate erasure/export. No recovery bypass via client flags or unverified email.
- Private S3-compatible document vault, real ClamAV, private bucket policy, encrypted storage, no public links, fail-closed scanning, upload and download authorization, EICAR-equivalent approved scanner test fixture only, outage/retry, durable deletion queue, backup-version erasure policy, strict MIME/PDF checks and audit logs.
- Validate document consent at the application level, withdrawal revocation, employer membership checks and account switch purges. Never treat malware-clean as RSA/license verified.
- Use secure secret-manager references and runbooks; do not provision paid infrastructure or ask for passwords in chat.
- Keep public document upload disabled until a real provider-backed staging acceptance test passes.

**Done when:** provider-backed staging tests, permissions, deletion, restore and failure-mode evidence are recorded; pending external access is explicitly BLOCKED, never DONE.

## Phase S3 — Stripe sandbox and Australian commercial checks (P0 before paid pilot)
- Preserve employee-free policy and fixed A$49 / A$30 / A$79 catalogue. Verify tax display/terms with business owner; no silent subscriptions.
- Test real Stripe **test account** Checkout and signed webhooks; fulfilment idempotence, five-slot reservation and concurrency, expiry, refund, chargeback/error display, retry/out-of-order events, role permissions, reconciliation, queue worker.
- Verify no entitlement from return URL, no paid post on failed/unverified payment, and no client-calculated price authority.
- For iOS/Android assess store purchase rules for any in-app ad upgrade before enabling commerce.
- Keep `NUA_STRIPE_MODE` disabled until secure sandbox credentials supplied; no live keys/charge.

**Done when:** genuine provider-backed test-event evidence exists; mock-only tests are not described as account-backed acceptance.

## Phase S4 — Android/iPhone UX and physical hardware acceptance (P0)
- Produce installable *internal* Android debug/test APK and iOS TestFlight/internal/simulator build when signer/dev account available; note exact SHA and app version.
- Validate on physical Android + iPhone, small and large screens, font scaling 200%, safe areas, keyboard, light/dark, TalkBack, VoiceOver, contrast, navigation, rotation, network loss/recovery, push destinations, app relaunch, token/session isolation, account switching.
- Exercise resume/certificate camera and PDF pickers with permissions denied, selected-only sharing, download cache cleanup, offline retry.
- Run real attendance with IANA venue time zone, DST ambiguous/nonexistent local times and duplicate taps.
- Capture at least 10 representative **real** device screenshots across worker/employer, labeled model/OS/build. Browser fixtures remain separate and cannot substitute for device acceptance.
- Enforce Android and iOS parity, with platform-specific adapters where required.

**Done when:** device matrix signed off, P0/P1 defects fixed or explicitly blocking; unsigned simulator exports must not be counted as store-ready binaries.

## Phase S5 — Operability, staging, legal website QA, controlled pilot (P0)
- Isolated staging with runtime/migrator role separation, durable worker/Redis, log redaction, monitoring/alerts, backup/restore to clean target, restore drill, rollback runbook, non-production fixture data and basic concurrency/load tests.
- Review public marketing pages and conversion journeys for accurate status: Australia prelaunch/pilot, NZ preview-only; no false screenshots, customer claims, country activation, compliance certifications or availability statements. Test responsive layouts, asset loading, SEO/noindex controls, cookie behavior, contact/privacy/terms, data access/deletion, AU business entity copy and accessibility.
- Prepare pilot support: incident triage, escalation owner, invite-only cohort (initial proposal: 5–10 Melbourne hospitality venues and 30–50 consenting worker testers), support channel, safe test communications, feedback tracking, incident-response thresholds, exit criteria.
- Pilot activation requires exact-commit evidence for ALL 11 entries in `docs/pilot/readiness.json`:
  1. database-isolation
  2. hiring-journey
  3. document-storage-scan
  4. identity-recovery
  5. android-device
  6. ios-device
  7. accessibility
  8. backup-restore
  9. monitoring-rollback
  10. business-legal-review
  11. owner-pilot-approval
- Run `pnpm pilot:check <40-character-SHA>` using the project script; a failed/pending gate is a **NO-GO**. Do not populate the evidence manifest with invented reviewers or timestamps.

## Required Claude work packaging
Create these PRs sequentially from the current integration `main` (split further if needed, no overlapping owners):
1. `fix/stabilise-baseline-ci-20261104`: exact-main green baseline, migration and contract checks, priority defects.
2. `fix/stabilise-security-hiring-20261104`: RLS, authentication, hiring, shifts and cross-platform security tests.
3. `feat/staging-identity-documents-20261104`: secure provider wiring and fail-closed tests (config gated).
4. `test/stripe-sandbox-acceptance-20261104`: only after Stripe sandbox access is provided; no production keys.
5. `test/device-and-pilot-readiness-20261104`: device/operability/marketing audit and pilot evidence.
Do not create empty placeholder PRs; open each when there is meaningful tested code or reviewable runbook content. Use existing branch names only after checking for collisions.

For each PR attach: baseline/head SHA, file inventory, precise acceptance cases, actual commands and results, coverage of AU/NZ negative gates, screenshots for UI changes, remaining BLOCKED items and rollback notes. Do not merge without required checks and review, and do not deploy/activate unless separately approved.

## Priority rule and escalation
- **P0:** tenant data access, credential recovery bypass, wrong pay/jurisdiction acceptance, duplicate payment grant, document disclosure, corrupt/inconsistent database migrations, app-breaking primary workflows.
- **P1:** inaccessible worker/employer journey, poor offline recovery, false marketing claims, incorrect in-app role behavior, significant device failure.
- **P2:** visual refinements, minor copy, microinteractions, non-critical speed.
Stop the release for any P0 and unresolved launch-critical P1. Do not bypass gates to achieve a date.

## Deliverable for ChatGPT independent review
Provide a concise `docs/reports/RELEASE_CANDIDATE_REVIEW_PACKET.md` with:
- exact candidate SHA, PR links, CI/Playwright/native run links and passed/failed/pending matrix;
- confirmed working/staging URLs (no invented URLs); migration readiness and data isolation evidence;
- real-device screenshot paths and usability issues; screen-reader and keyboard results;
- provider-backed versus mocked Stripe, S3/ClamAV, push and identity tests;
- complete 11-gate pilot register plus reviewer links, with all missing items named;
- up to 10 focused UX/copy refinements for ChatGPT, separate from Claude's blocking fixes;
- a plain **GO / NO-GO** recommendation with reasons. Default is **NO-GO** until all gates are verified.

**Next immediate action for Claude Code:** start S0 against the real current `main`. Do not assume the earlier maximum-workload handoff's PR statuses are still current.