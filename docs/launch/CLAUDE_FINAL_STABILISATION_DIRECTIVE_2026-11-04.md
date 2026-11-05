# NUA CREW — Claude Code: close all actionable launch gates
**Issued:** 4 November 2026 (Melbourne)  
**Mode:** execution, not proposal. Work on short-lived branches from current `origin/main`.  
**Ownership:** Claude Code = implementation, tests, 8 reports, staging preparation, screenshots and PRs. ChatGPT = independent release audit and final UI/security review.  
**Safety:** release approval is NOT granted for production migrations, public user activation, production API deployment, live payments, app store distribution or New Zealand hiring.

## Update (5 November 2026)

PR #32 has now merged into main at `5112b601452b4302d633562f517d6581f63ea290`, including the availability/privacy fix and 12 browser screenshots. Do not redo that work. A$49/14-day employer advertising and A$79 combined (A$30 boost) are in draft PR #33 pending validation. Historical baseline SHA references below are for audit only; fetch latest main before new tasks.

## Read before coding
1. Read `docs/launch/LAUNCH_STABILISATION_EXECUTION_2026-11-04.md`, issue #31 and `docs/pilot/readiness.json`.
2. Fetch remote refs and record SHA. **Do not rely on GitHub's default branch** `claude/new-session-kszaxl`: it is stale. Use `origin/main`.
3. PR #28 already integrated #25 + #26 (backend country migration and read-only markets). PR #29 integrated #11 (wallet/workspaces/pilot). Both are merged. **Never re-merge them**. Review and test current merged code.
4. Verified: PR #28 CI run `41600879999` had successful api/web/dependency-audit/e2e. PR #29 CI run `41605820811` had successful api/web/dependency-audit/e2e; native build run `41605820854` had successful Android debug/iOS simulator jobs. Documentation PR #30 CI run `41656219974` succeeded. These are head-commit checks, NOT pilot sign-off.
5. The current main baseline at audit was `f10a55e817a0af2681fd8cccb73ba3c105d8ad01`. **Re-fetch immediately** and use newer main if changed. Open PR #30 is documentation-only. Existing 11 formal pilot gates are PENDING. No new features during this freeze except necessary blockers.

## Decisions already made — don't wait for owner to repeat them

### D1 — Country migration
- The **code for revision `c55d06a11005` is merged**, after wallet migration `a44b95ef1004`; it is not yet independently verified on production.
- **Start now**: create a non-mutating preflight for the real target environment; backup/PITR verification, actual migration head and lineage, schema diff, per-table row counts, null-country/provenance aggregates, lock-risk estimate, indexes, execution time in staging clone, backward compatibility and rollback/roll-forward. Request approval before any production database mutation.
- Run clean and anonymised-copy **staging** migrations using the dedicated migrator role and non-BYPASSRLS runtime tests. No automatic legacy AU backfill; preserve unresolved records, no country inference from IP/AUD/default AU.
- Flag that a four-digit postcode + Australian state is a *consistency check, not independent business/location verification*. Document exactly what `verified_workplace_country` proves; do not weaken current protective gates.
- Outcome: migration **STAGING-GO** if evidence passes; **PRODUCTION-BLOCKED** until specifically approved. Do not use "already merged" as production migration proof.

### D2 — Deployment topology
- **Decision for the engineering plan:** use distinct Vercel projects for `apps/site`, `apps/web` (candidate) and `apps/employer`. Keep the existing `nua-crew-site` project; do not repurpose it for the transactional apps.
- For the Python FastAPI API, durable worker, Postgres/pgvector, Redis and private ClamAV scanning, draft a production-grade **Sydney-region AWS** deployment using separately managed runtime/worker tasks (ECS Fargate or equivalently documented continuous container hosting), RDS PostgreSQL, ElastiCache Redis, encrypted private S3, ClamAV internal network and CloudWatch monitoring. The worker is persistent; **do not pretend Vercel functions are a substitute** without rearchitecting/validating scheduling, queues and failure handling.
- Proposed (NOT verified, not live) branded subdomains, dependent on verified DNS control: `crew.nuapos.com.au` (site), `jobs.crew.nuapos.com.au` (worker web), `hire.crew.nuapos.com.au` (employer web), `api.crew.nuapos.com.au` (API). Do not overwrite `iksaa.com.au` DNS or promote a domain unilaterally. Inspect existing Vercel alias `iksaa.com.au`; site code currently defaults `NUA_SITE_URL` to `https://iksaa.com.au`, and defaults job/hire to `app.iksaa.com.au` / `hire.iksaa.com.au`. Prepare a migration matrix; require domain ownership and approval prior to DNS changes.
- Produce Terraform/IaC or deployment manifests and strict env-var inventory (no secrets committed), HTTPS/CORS/cookie/session strategy, managed identity endpoints, private ingress, queue/worker observability, Vercel root directories, immutable versions, rollback and cost estimate. Stage with dummy fixtures only if owner-approved access is already available; do not purchase services or apply Terraform without approval.
- Outcome: **DEPLOYMENT-ARCHITECTURE-GO** with reviewed plan; **LIVE-API-BLOCKED** until infrastructure and secrets actually exist.

## Execute all actionable tasks in this order

### A. Prove complete hiring journey on integrated main
- Run and, if missing, extend the *full browser E2E* across three frontends/API and real isolated Postgres with forced RLS: candidate register/profile/search/apply/withdraw; employer register/verification/venue/guided pay/create/publish/shortlist/invite/message/decision; shifts availability/booking/conflict/check-in/out/actuals/corrections/cancellation/no-show/historical hours; notifications and account deletion.
- Include realistic hospitality fixtures for Melbourne; show 320/360/390/430 widths, 768 tablet, 1440 desktop, light/dark, keyboard and axe; include both AU market selectors and blocked NZ attempts.
- Capture **at least 12 real automated-browser screenshots** with route, viewport, fixture label, SHA; do not label browser captures as physical Android or iPhone.
- Add negative cases: cross-tenant application/doc access, broken/missing authorization, self-granted owner membership, malicious country swap, job/venue mismatch, prior employer after sign-out, concurrent invites/shifts, duplicate webhooks, time-zone DST and stale pay rule, error recovery on offline retry.
- Correct actual bugs. Run API, TypeScript, lint, tests, contract drift, 3 site builds, E2E and native bundles on the same SHA. Provide exact URLs and screenshots. Mark "hiring-journey" evidence only after independent reviewer acceptance.

### B. Complete the eight outstanding reports — avoid duplicate files
First search `docs/` for prior reports. Update an existing authoritative report when present; create a new one only when missing. All reports must include a status table with **PASS / FAIL / BLOCKED / NOT TESTED**, exact SHA, commands and cited CI evidence:
1. `docs/reports/COUNTRY_ARCHITECTURE_2026-11-04.md`: legal domicile vs job venue vs candidate search, audited legacy provenance, AU live/NZ blocked, future markets.
2. `docs/reports/THREAT_MODEL_2026-11-04.md`: STRIDE, tenant/RLS, access tokens, documents, Stripe, worker trust boundary, attack tests and owners.
3. `docs/reports/AWARD_GOVERNANCE_2026-11-04.md`: Fair Work modern award/source/effective-date provenance, rates not verified until approved, classifications, penalty hours, zero NZ mapping, publish gates.
4. `docs/reports/NZ_ACTIVATION_GATES_2026-11-04.md`: NZBN, immigration, privacy, labour hire, independent wages/holidays, GST and merchant account; all transactional NZ flags OFF.
5. `docs/reports/STRIPE_TEST_ACCEPTANCE_2026-11-04.md`: checkout A$49 / A$30 / A$79, idempotency, signed webhooks, refund, five placement slots, order expiry, mock vs real test evidence.
6. `docs/reports/INTEGRATED_HIRING_E2E_2026-11-04.md`: happy and unhappy paths, timings, reproducibility, screenshot file inventory and CI links.
7. `docs/reports/CROSS_PLATFORM_VISUAL_AUDIT_2026-11-04.md`: employer/candidate/site/mobile, accessibility, navigation, screenshot comparison and fixes; no misleading screenshot labels.
8. `docs/reports/GO_NO_GO_GATE_REVIEW_2026-11-04.md`: exact-commit 11-gate pilot registry, blockers, mitigations, external approvals and final recommendation.
- Remove/correct stale "iOS unfinished" wording in its original delivery report **only if the statement is no longer true**. State accurately that build-validation success differs from physical iOS device and store-signing acceptance.
- Update top-level `docs/IMPLEMENTATION_TRACKER.md` to distinguish historical snapshots from authoritative current state.

### C. Make every independently actionable item GO
- **Security:** verify FORCE RLS with independent credentials; IDOR/document sharing; rate limits; session revocation; admin/owner/recruiter/viewer; immutable audit histories; signed request/event replay.
- **Identity:** implement production-grade MFA/recovery architecture and automated tests; provide sandbox integration steps. Provider-backed sign-off needs a configured account, not fake evidence.
- **Documents:** private S3-compatible storage, ClamAV, fail-closed scanning and monitored cleanup, backup/restore, least-privilege; build tested service adapters and documented IaC without deploying if access absent. Keep intake OFF.
- **Stripe:** run all local simulated acceptance now; generate safe scripts/fixtures and webhook failure tests. When connected Stripe sandbox becomes available, run real provider events, capture transaction IDs in a private secured log (no secrets). Keep live payments OFF; employees free.
- **Mobile:** keep Android debug and iOS simulator builds green; create internal build matrix, EAS profiles, install guides and device-test scripts. Physical Android/iOS "GO" only after real device evidence and signing.
- **Site:** full responsive + policy/SEO/noindex + truthful product status + branding audit; keep all AI wording removed; do not reintroduce old banners. Verify `iksaa.com.au` canonical and DNS are intentional before changing anything.
- **Ops:** run staging backup/restore and migration rehearsals where authorized; prepare dashboard/alerts, queue health, scanner outage and rollback, runbook and pilot support playbook.
- **Privacy:** verify employer/worker data access and deletion; legal review needs real counsel/owner approval, not generated sign-off.
- Build all possible tests now, no waiting for credentials to do ordinary engineering work.

### D. Deliver precise release-gate outcomes
Pilot gates in `docs/pilot/readiness.json` are: database-isolation, hiring-journey, document-storage-scan, identity-recovery, android-device, ios-device, accessibility, backup-restore, monitoring-rollback, business-legal-review, owner-pilot-approval.

For **each** gate:
- `ENGINEERING PASS`: code and tests green on exact SHA (only when true).
- `PROVIDER PASS`: external staging provider verified (only when true).
- `REVIEW ACCEPTED`: a named independent owner/reviewer accepted same release SHA (only when true).
- `PILOT GO`: all mandatory evidence per the existing checker, with no P0/launch-critical P1.
- Otherwise mark `BLOCKED` and detail minimum external action. Do not falsify manifest fields just to make `pnpm pilot:check` green; do not change its required-gates list to weaken release.
- Produce evidence references for all remaining failures, even if only a dry-run/capability report.

## Exact handback for ChatGPT — after Claude completes engineering
Create `docs/reports/CLAUDE_TO_CHATGPT_RELEASE_HANDOFF_2026-11-04.md` containing:
- Latest SHA; PRs and all checks; test totals and failures; list of changes and regression risks.
- Hosted/staging URLs actually verified; proposed URLs separately identified.
- 12 browser screenshots and real-device screenshots separately; relevant click-throughs if hosted.
- Eight reports, migration preflight and deployment architecture with cost estimates.
- 11 gate-by-gate labels with evidence and who must act.
- A **short** list of residual non-P0 UX/copy items for ChatGPT. Claude must finish all P0/P1 code, not hand them off.

## Forbidden shortcuts
No production migration, domain changes, new Stripe live keys, public site indexing, job publication for NZ, user-facing production signup or real employee documents without separate formal approval and consent. No synthetic screenshots, pretend provider acceptance, cherry-picking green CI from a different SHA, or merging a red P0 PR. Do not ask the owner for an answer already contained here. For genuine access blockers, produce the complete safe work product and list the **single concrete external action** needed.

**Start with task A immediately**. Once A is green, execute B and C in parallel where safe, and deliver D + handback.