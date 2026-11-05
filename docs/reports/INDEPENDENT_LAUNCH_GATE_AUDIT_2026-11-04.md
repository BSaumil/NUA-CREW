# NUA CREW — Independent Launch Readiness Review (ChatGPT)
**Date:** 4 November 2026 (Australia/Melbourne)  
**Source examined:** GitHub `BSaumil/NUA-CREW` `main` at `f10a55e817a0af2681fd8cccb73ba3c105d8ad01`; Vercel project inventory; previously merged PRs #28 and #29.  
**Scope:** source-level and connector evidence inspection. This is NOT a real-device test, deployed API smoke test, production migration, or independent legal/payroll opinion.

## Verified passes (with boundaries)

| Area | Verified evidence | What it does NOT prove |
| --- | --- | --- |
| Backend + web + dependency + E2E jobs | #28 head `6444d3a9350942fe70f7e83215d3af6efde535df`: [workflow 41600879999](https://github.com/BSaumil/NUA-CREW/actions/runs/41600879999), all four jobs success. #29 head `ef8b6d7f67929a7bb3064a36be936a528df5c517`: [workflow 41605820811](https://github.com/BSaumil/NUA-CREW/actions/runs/41605820811), all four jobs success. | Exact merge-commit/main-push acceptance, provider-backed integrations or real production users. |
| Native compile | [Native build workflow 41605820854](https://github.com/BSaumil/NUA-CREW/actions/runs/41605820854): android-debug and ios-simulator both success. | Signed store builds, actual-device accessibility, push or documents. |
| Integration | #28 combined jurisdiction backend and contract; #29 integrated wallet, workspace and pilot. One declared migration chain ends in `c55d06a11005` after `a44b95ef1004`. | Production migration execution or provenance verification. |
| Documentation checks | PR #30 head `6e74ce105e39846c9c7b129297518ec409f07597` CI workflow `41656219974` success. | Review/merge approval; new PR changes require fresh evidence. |

## Verified pilot blockers
- Current `docs/pilot/readiness.json` has 11 `pending` entries; no signed acceptance entries.
- `docs/DOCUMENT_VAULT_SETUP.md` says S3-compatible storage and real ClamAV are not configured; uploads default disabled.
- `docs/STRIPE_SETUP.md` says no Stripe account connected; no real checkout or provider-backed webhooks yet. Code supports test/disabled mode; live keys rejected.
- `apps/mobile/app.config.ts` still uses provisional `com.example.nuacrew` bundle/package identifiers and blocks distributable builds without real project ID and approved HTTPS API.
- `apps/web/lib/api.ts` and `apps/employer/lib/api.ts` default to `http://localhost:8000` absent `API_BASE_URL`; no online API host was verified.
- Vercel account inventory for BSaumil includes one `nua-crew-site` project (ID `prj_d0KGaH2XnFHppJMlnW9JOLtgTodz`) and no identifiable separately named NUA Crew candidate or employer projects. The marketing project returned `live: false` with a latest READY preview; not evidence of a production application.
- The marketing project has `iksaa.com.au` in its project-domain inventory. `apps/site/lib/site.ts` also hardcodes `iksaa.com.au` as fallback canonical, with `app.iksaa.com.au` and `hire.iksaa.com.au` fallbacks; changing that without DNS/owner verification could break existing sites. Review host and brand plans explicitly.
- GitHub repository default branch is `claude/new-session-kszaxl`, not `main`. It may mislead CI integrations and new clones; coordinate an admin change without destructive rewrite.
- `apps/employer/lib/api.ts` currently selects `viewer.memberships?.[0]` as the sole active workspace. For a multi-employer account this is an explicit MVP limitation; test switching and membership isolation before expanding the pilot.
- `services/api/app/services/jurisdictions.py` treats AU state + four-digit postcode as corroborating `locations.country`. This is an *internal plausibility check*, not independently verified legal/workplace evidence; don't portray as business verification.
- The revision `c55d06a11005` defines additive nullable columns and constraints. It is merged code, but a production migration requires actual DB state, backups, migration timing, locks, safety and explicit approval.

## My deployment recommendation (architecture GO, deployment still blocked)
- Keep the marketing site on its own Vercel project. Prepare *two separate* Vercel projects for `apps/web` candidate app and `apps/employer`, with monorepo-aware root/build configuration.
- Run the stateful FastAPI API and scheduled/continuous worker as separate long-running services in AWS Sydney (`ap-southeast-2`) with RDS PostgreSQL/pgvector, managed Redis, S3 and private ClamAV + monitoring; inspect cost, least-privilege network and region carefully. This is a recommended topology, not a provisioned or approved cloud system.
- Proposed DNS only, subject to domain owner validation: `crew.nuapos.com.au`, `jobs.crew.nuapos.com.au`, `hire.crew.nuapos.com.au`, `api.crew.nuapos.com.au`. Keep the present `iksaa.com.au` alias unchanged pending review.
- First author IaC, environment matrix, cost/rollback, staging-only migration preflight and mocks. Do not incur spend, map DNS or enable payments without owner approval.

## Independent review disposition

| Subsystem | Current review disposition |
| --- | --- |
| PR-head CI & native build pipelines | **Engineering PASS** for the recorded PR-head SHAs |
| Current production DB migration | **BLOCKED** — preflight and explicit approval missing |
| Candidate/employer hosting | **BLOCKED** — projects not provisioned/verified |
| Full invited-cohort journey | **NOT YET ACCEPTED** — needs evidence on integrated release candidate |
| Stripe provider-backed sandbox | **BLOCKED** — account not connected |
| Document storage + malware scanning | **BLOCKED** — actual provider testing missing |
| Real Android and iPhone | **BLOCKED** — signing/device evidence absent |
| NZ transactional launch | **INTENTIONALLY DISABLED** |
| Public AU release / invited pilot | **NO-GO** until required gated evidence and owner approval |

## ChatGPT ownership from here
1. Independently review Claude's integrated E2E trace/screenshot pack once produced. Challenge misleading UX, ambiguous "verified" claims, inaccessible flows, employer/worker confusion and invalid country/pay labels.
2. Inspect representative employer/candidate journeys and the marketing site for keyboard behavior, 320–430px mobile responsiveness, wording, contrast and real navigation. Record failures as GitHub review findings with exact reproduction.
3. Audit the final 11-gate readiness report; accept only evidence at the release SHA and verified external-service/device tests. Do not silently mark pending gates as passed.
4. Prepare user-facing release decision, with separate **GO** for verified subcomponents and **NO-GO** for anything lacking mandatory evidence.

**Review status:** this report finishes the initial independent evidence audit, not the final independent acceptance.