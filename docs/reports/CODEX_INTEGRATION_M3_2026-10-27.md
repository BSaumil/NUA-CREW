# NUA CREW — Integrated takeover handoff
**Date:** 27 October 2026, Melbourne  
**Owner:** Saumil Bhatt  
**Working branch:** feat/integrated-m3-20261027  
**Status:** Both workstreams integrated; M3 support and overlap protection implemented in source, with database integration verification blocked. Not release-ready.

## What is now together

The supplied NUA_CREW_M2.bundle was verified and imported. It contains complete history through e9b4d130b09bde4d224cbc33850ce56ca8d9c2fa, one documentation commit beyond the reported M2 implementation head 2e5dd5f.

Claude's M0/M1/M2 work and Codex's local fixes are reconciled on one feature branch. Integration commit: 110ee3e. Later commits on this branch contain the support and scheduling changes described below; use git log to identify the final tip.

No source was pushed, no PR was opened, no production deployment or main merge occurred, and no real message or payment was sent.

## Product decisions retained

- Android and Apple iOS first; AI features deferred.
- Employees free across all Australian states and territories, on every platform. No employee SKU, paywall, billing requirement or automatic future activation.
- Employer advertisement: A$19 for 14 days; re-advertisement A$19 for another 14 days.
- Promotion: A$30 additional for five days; assumed A$49 for a new ad with one promotion.
- Promotions require reserved top-five inventory with defined local/category scope before they can be sold.
- No automatic renewal. Catalogue and estimates remain informational; payments are disabled.
- Tax/channel setup, brand clearance and production identity remain unresolved.

## Integration decisions and fixes

### Sessions and native application safety
Retained generation-bound login/start/refresh, serialised secure storage, immediate memory invalidation on logout, truthful secure-delete failure reporting and query-cache clearing.

Kept the response-generation check in unwrap/unwrapVoid so an API body decoded after an account change cannot enter the new account's UI/cache. Preserved M2's useful session state getters and revocation of refresh credentials returned after the original session ended.

Retained the structured sign-out result, but optional push cleanup cannot block logout. Login and registration results must still belong to the session generation that initiated them.

Preserved M2's shared keyboard-aware Sheet and share-link helpers. Improved its application guard to retain ambiguous retry keys by payload, including edits from A to B and back to A. A new regression test covers that sequence.

### Database roles and dependencies
Kept Claude's separate migrator/runtime role design and stronger non-owner RLS tests. Removed the obsolete single-role CI helper to avoid competing bootstrap instructions. The authoritative bootstrap is db/roles/bootstrap.sql, mirrored in infra/docker/initdb/bootstrap.sql.

Rebuilt the merged lockfile under the existing strict release-age policy. Retained the narrow Expo CLI Zod override and Vitest 4. No release-age exemptions or advisory suppressions were added.

### Pricing API
Resolved duplicate pricing definitions and removed duplicate router registration caused by the automatic merge. A single catalogue supplies both clients' informational fields. The employer estimate endpoint and elapsed-duration helpers are retained, with amounts derived from the same product definitions.

### Invitation filtering
Both candidate and employer invitation lists previously applied effective status filtering after limiting rows. A requested pending invitation could disappear behind newer declined records. Status and effective expiry now filter in SQL before the page limit. A database regression test has been added; its execution is blocked by the missing database.

## New M3 support workflow

The employer web app now accepts operator sign-in and routes administrators to /admin. Authentication and admin authorisation are checked independently in server actions and API dependencies.

The support page provides:
- A paged open-report queue showing only the reported excerpt, reason and receipt time.
- Explicit review outcomes: resolve, dismiss, or close the reported conversation.
- Mandatory decision reason and reviewer confirmation.
- Business queues for unverified, pending, verified and rejected organisations.
- Evidence-based verification/rejection, keeping a case pending, and revoking verification through the existing audited API.
- Accurate errors and empty states; no simulated success.

New API routes:
- GET /v1/admin/message-reports
- POST /v1/admin/message-reports/{report_id}/review

Report review uses a row lock and one terminal closure. A second review conflicts rather than overwriting the first. Closing a conversation locks the conversation row and stops future messages through the existing message-send state guard. Stronger block restrictions are preserved.

Report views and decisions are audited. The decision audit stores outcome and reason code, not another copy of the message excerpt. No entire inbox or unrelated conversation history is exposed.

No new operator registration, default credentials or broadened tenant permissions were added. The current development identity adapter is still not production identity/MFA. This portal does not replace a documented support/appeal/retention process.

## New database overlap protection

Migration a31c91e5a401 follows d04d303111e7. It adds ex_commitments_confirmed_overlap, a GiST exclusion constraint on candidate identity and the UTC half-open work interval, restricted to confirmed commitments.

Consequences when deployed and verified:
- Two overlapping confirmed commitments for one candidate cannot both commit, even if a writer bypasses API row locking.
- Adjacent intervals are allowed.
- Different candidates remain independent.
- Existing overlapping manual held rows retain their previous semantics.
- Application submission still does not reserve a worker.

The administrator bootstrap now installs btree_gist. The migration fails clearly if it is absent. It also fails if existing confirmed overlaps exist; it never silently deletes booked work. Review conflicts before migrating a populated environment.

API add/confirm paths translate exclusion failures into the existing commitment_conflict response. Direct database and two-connection concurrency tests have been added.

**This is not the complete shift-booking lifecycle.** Offered/held/confirmed expiry, transactional employer bookings, shift capacity, cancellations, timesheets and payroll remain future implementation.

## Verification performed in this workspace

| Check | Actual result |
| --- | --- |
| Mobile Jest | 180 passed, 23 suites |
| Shared UI Vitest | 39 passed |
| Shared API-client Vitest | 2 passed |
| Isolated Python pricing/operator-boundary tests | 16 passed |
| Pure availability tests, without DB fixtures | 14 passed |
| Workspace TypeScript checks | All seven packages passed after the final application-guard edit |
| Workspace lint | All seven packages passed after the final application-guard edit |
| Ruff | Passed |
| Ruff format | Passed |
| Strict mypy | Passed; stale cache cleared after integration |
| Next employer production build | Passed, including /admin |
| Next candidate production build | Passed |
| Android and iOS Hermes exports | Passed after final application-guard edit; 39 assets, approximately 3.5 MB per bundle |
| Full Alembic upgrade SQL generation | Passed |
| New revision downgrade SQL generation | Passed |
| Python production dependency audit | No known vulnerabilities found against the exported locked production requirements |
| pnpm production dependency audit | Failed: one high node-forge finding remains |
| Database integration/migration execution | Blocked: localhost:5432 refused connection |
| Browser tests against actual API | Not rerun; require the database-backed stack |
| Actual iPhone/Android device tests | Not available |
| GitHub Actions / Docker Compose | Not run |

The source adds seven database-backed regression cases covering moderation, overlap and invitation filter ordering. They are not claimed as passing: the targeted run stopped at database role fixture setup because PostgreSQL was unavailable. The earlier Claude counts (164 API / 29 Playwright) are historical handoff evidence, not independently rerun integrated results.

The shared UI tests emit jsdom canvas-not-implemented warnings while passing. No visual/device accessibility claim is inferred from passing unit tests.

Initial Next/Turbopack and mypy runs encountered stale-cache internal errors after branch integration. Clearing generated caches resolved them; no checks were disabled.

Hermes exports are neither APK/IPA installers nor device validation.

## Dependency audit detail

pnpm audit --prod --audit-level=high still reports GHSA-86w9-cpqp-85rv through Expo CLI's node-forge dependency.

The npm registry now lists node-forge 1.4.1, published 27 October 2026 at 04:44:07 UTC; the retrieved advisory page still lists no patch, so the sources disagree on freshness. The registry/audit indicate a candidate patch, but its age is below the project's policy cutoff. It was not forced in or exempted. When eligible, review upstream compatibility and provenance, update narrowly, and rerun audit plus bundle/build tests. Do not simply remove the audit gate.

The CI Python audit previously invoked an isolated pip-audit environment without explicitly pointing it at the app's locked dependencies. It now exports production requirements from uv.lock and audits that file. CI also supports manual workflow_dispatch once source publication is separately authorised.

## Remaining implementation and release work

1. Obtain a usable disposable PostgreSQL 16 + Redis environment, bootstrap the split roles, and run the full API/RLS/migration/concurrency suite and actual browser tests.
2. Review the new support screen in a running browser with test operator/candidate/employer accounts, including server-action failures and accessibility.
3. Resolve the dependency audit through a policy-eligible, verified patch.
4. Exercise the device checklist on real iPhone and Android devices; supply actual signing/EAS/push configuration for installable builds.
5. Implement native employer mode. The native app remains candidate-focused; the employer web app and operator support UI are not a native employer app.
6. Implement the offered/held/confirmed booking lifecycle and expiry before live shift bookings; the new constraint covers confirmed manual commitments only.
7. Build employer account refinements, sandbox payment ledger/store verification, advertisement expiry/renewal and reserved promotion inventory. No checkout is currently connected.
8. Configure production OIDC/PKCE, operator MFA, secret/role management, approved email/SMS and observability.
9. Complete award-aware pay guidance with reviewed/versioned sources and explicit unsupported states, plus remaining legal/privacy/brand launch decisions.

These are genuine outstanding items. This handoff must not be represented as a finished or launch-approved product.

## Resume from the combined bundle

For a fresh checkout:

    git clone NUA_CREW_INTEGRATED_M3_2026-10-27.bundle NUA-CREW -b feat/integrated-m3-20261027

For an existing checkout, preserve uncommitted work first, import the branch and inspect ancestry before switching or merging. The bundle contains committed history only; it does not include credentials, local environment files, node_modules, database data or native signing configuration.

Read CLAUDE.md, applicable AGENTS.md files, docs/ACCOUNT_BILLING_PLAN.md and this report. Continue on a feature branch. No production deployment, live billing, main merge, source publication, purchases or real messaging without the required separate authorisation.

---

Saumil Bhatt

