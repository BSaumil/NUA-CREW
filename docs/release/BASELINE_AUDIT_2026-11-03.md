# Baseline audit — 3 November 2026

Evidence below was observed in this session; anything not observed is marked as such.

## Branch and deployment truth

| Item | Observed |
| --- | --- |
| Integration baseline | `main` at `414f483` (merge of #27), after #22–#24 |
| Production website | Vercel project `nua-crew-site` builds `apps/site` from `main`. Deployment for `414f483` was READY and aliased to `iksaa.com.au` (Vercel deployment record, `githubCommitRef: main`) |
| Candidate web, employer web, API, mobile | **No deployment target was found** (only the marketing site exists as a Vercel project in the team). Not deployed from this session |
| GitHub default branch | Handoff reports `claude/new-session-kszaxl`, 111 behind `main`. Not changed. Changing it needs owner approval |

## Open PR reconciliation

| PR | State at start | Resolution |
| --- | --- | --- |
| #26 backend jurisdiction contracts | open, unstable, 6 behind `main` | Merged into #28 as a merge commit |
| #25 country-aware storage | open, clean, 6 behind | Merged into #28 as a merge commit |
| #11 wallet / workspaces / pilot | open, `dirty`, 62 behind, 110 files | Merged onto #28's branch in #29 |

Overlap between #25 and #26 was `services/api/app/schemas.py` (merged cleanly) and the two generated contract files. The textually merged contract disagreed with the merged code, so it was regenerated once (`pnpm contracts`).

Overlap between #11 and the rest: three file conflicts (`packages/ui/src/index.ts`, `apps/mobile/src/ui/primitives.tsx`, `docs/IMPLEMENTATION_TRACKER.md`), resolved as unions, plus **two Alembic heads** (`a44b95ef1004` document vault and `c55d06a11005` country jurisdictions). The country migration was re-parented onto the document vault revision; neither was deployed.

## Provenance decision

`locations.country` has a historical `AU` default and is not evidence. Publishing a job or creating a shift now requires the venue to corroborate Australia (AU state or territory and a four-digit postcode) through `verified_workplace_country`. Otherwise the action fails closed as unverified. There is **no backfill** and no client-supplied country is trusted.

## Verification (local, real Postgres with least-privilege roles)

| Check | Result |
| --- | --- |
| API `ruff`, `ruff format --check`, `mypy app` | pass |
| API `pytest` on a freshly created database, #25 + #26 + #11 combined | 357 passed |
| Alembic single head; `downgrade a44b95ef1004` then `upgrade head` | clean |
| `pnpm typecheck`, `lint`, `format:check` | pass |
| UI 50, markets 34, API client 2, mobile 263 tests | pass |
| Android and iOS Hermes bundle export | pass |
| Browser E2E on the combined branch | **not run locally**; CI on PRs #28 and #29 is the evidence |

## Not verified in this session

Production migration, staging deployment, real-device Android/iOS, private object storage, malware scanning, Stripe test-mode checkout, identity provider. No production migration is authorised: #25's schema change needs separate explicit owner approval, preflight and rollback.
