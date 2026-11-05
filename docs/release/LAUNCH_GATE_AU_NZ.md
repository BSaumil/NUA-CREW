# Launch gate — Australia and New Zealand (status 4 November 2026)

Status words: PASS (evidence exists), OPEN (not met), BLOCKED (needs an outside input).

## Australia — controlled pilot, not public launch
| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Code on `main`, CI green, single Alembic head | PASS | #28, #29 merged; all CI jobs green; head `c55d06a11005` |
| Tenant isolation and role tests | PASS | `test_rls.py`, `test_marketplace.py`, `test_shifts.py`, `test_attendance.py` |
| Production database migration reviewed and approved | OPEN | `docs/handoff/CHATGPT_DECISION_PACKET_2026-11-04.md` |
| Deployment target for API, worker, candidate and employer web | OPEN | Only the marketing site is deployed |
| Private document storage and malware scanning | BLOCKED | Uploads stay disabled |
| Verified award rates | OPEN | Rates are `supplied_unverified` until an admin verifies each against the official pay guide |
| Real-device Android and iOS acceptance, signing | BLOCKED | No devices or signing assets |
| Managed identity/recovery, push provider, monitored worker, backup/restore rehearsal | OPEN | Listed in `docs/pilot/CONTROLLED_PILOT.md` |
| Legal and business entity review (including the ABN shown in the footer) | BLOCKED | Owner and counsel |
| Billing | OFF | Stripe skipped for now; `NUA_STRIPE_MODE` disabled |

## New Zealand — preview only
| Gate | Status |
| --- | --- |
| UI shows NZ as preview; submit, publish, pay and billing disabled; server rejects NZ before the API | PASS (`country-ui.spec.ts`, server-action guard) |
| API fails closed for NZ onboarding, publishing and shifts | PASS (`test_markets*.py`, `test_legacy_country_guards.py`) |
| Verified NZ employment-law rules and sources, NZ pay engine, NZ legal entity, NZ pricing and tax | BLOCKED — see `docs/compliance/NZ_READINESS_GATES.md` |
| Owner approval to enable any NZ capability | OPEN |

NZ capabilities remain off until every row above is PASS **and** the owner approves in writing.
