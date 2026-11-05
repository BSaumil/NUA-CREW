# NUA CREW — Claude delivery report, 3 November 2026

Baseline: `main` at `414f483`. Status words are used strictly: *authored*, *PR open*, *merged*, *deployed*, *validated*.

## Completed this batch

| Item | Status | Evidence |
| --- | --- | --- |
| #26 + #25 combined into one contract and one migration | merged [#28](https://github.com/BSaumil/NUA-CREW/pull/28) | CI green: `api`, `web`, `e2e`, `dependency-audit` on `6444d3a` |
| Venue corroboration before treating a workplace as Australian | in #28 | Unit tests; `locations.country` AU default no longer counts as evidence |
| #11 salvaged onto that baseline (3 conflicts, 2 Alembic heads fixed) | merged [#29](https://github.com/BSaumil/NUA-CREW/pull/29), stacked on #28 | CI green: `api`, `web`, `e2e`, `dependency-audit`, `android-debug`, `ios-simulator`. Merged as `f10a55e` |
| Baseline audit | authored | `docs/release/BASELINE_AUDIT_2026-11-03.md` |

#25, #26 and #11 were closed as superseded.

## Local verification (real Postgres, least-privilege roles)

API ruff, format and mypy clean; `pytest` 357 passed on a fresh database; Alembic single head and downgrade/upgrade clean; `pnpm typecheck`, `lint`, `format:check` pass; UI 50, markets 34, API-client 2, mobile 263 tests; Android and iOS Hermes bundle export passes.

## Not done in this batch (stated plainly)

- Work packages B (full multi-country model beyond the existing registry), C, D, E, F, G, K were **not** implemented or re-validated here. Existing merged work (#2, #14, #20, #22–#24, #27) is untouched.
- A new full hiring-journey run with fresh screenshots from the combined branch was **not** produced. The CI browser suite passing on the combined branch is the only journey evidence.
- Documents not yet written: country registry/jurisdictions architecture, tenant/consent/document threat model, AU award governance, NZ readiness gates, Stripe sandbox, end-to-end test report, visual audit, launch gate.
- Real-device Android/iOS acceptance, private object storage, malware scanning, Stripe test credentials, identity provider: unavailable; uploads stay disabled.

## Deployment

Nothing was deployed from this batch. The marketing site from `414f483` is live at `iksaa.com.au`. No deployment target exists in this session for the API or the candidate/employer web apps.

## Owner decisions strictly required

1. **Approve (or decline) #25's schema migration for production**, with a preflight and rollback plan. Not run anywhere beyond local and CI databases.
2. Confirm that #28 then #29 may be merged to `main` once reviewed.
3. Provide Stripe test credentials, a private storage/scanner decision, and signing assets when those streams start.

## Small refinement packet for ChatGPT

1. `services/api/app/services/jurisdictions.py` `verified_workplace_country`: is "AU state + four-digit postcode" a sufficient corroboration rule for legacy venues, or should an explicit `country_source` column be added to the migration?
2. `services/api/alembic/versions/20261103_c55d06a11005_country_jurisdictions.py`: review the re-parenting onto `a44b95ef1004` and the nullable, un-backfilled columns.
3. `docs/IMPLEMENTATION_TRACKER.md`: reconcile the merged sections against actual verification (both sides were kept as a union).
4. Copy review of the NZ preview notices in `packages/ui/src/market.tsx` and `apps/mobile/src/features/markets.ts`.
5. Confirm the AU `prelaunch` informational flag in `/v1/markets` is not read by any client as a reason to disable existing AU routes.

## Update, 4 November 2026
- Merged: #28 (`bb930e8`), #29 (`f10a55e`). Marketing site build for `f10a55e` was READY at `iksaa.com.au`. Nothing else is deployed.
- Journey run on the local stack, 12 real screenshots, and the reports are in `docs/qa/`, `docs/release/LAUNCH_GATE_AU_NZ.md`, `docs/architecture/`, `docs/compliance/`, `docs/security/`.
- The migration go/no-go and deployment-target decisions are packaged for ChatGPT in `docs/handoff/CHATGPT_DECISION_PACKET_2026-11-04.md`.
- Stripe test mode was skipped by the owner for now; its document and tests are not written.
