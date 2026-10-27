# M2 report — reconcile, invitations, messaging (2026-10-27)

**Branch:** `feat/invitations-messaging-20261027` (local; branched from `feat/m0-m1-availability-20261027` at `22370c8`). **Published:** NO. Nothing was pushed, no PR, no deploy, no real invitation or message was sent to anyone, no live billing, no scraping. Another checkout cannot fetch these commits.

## Sources inspected
| Source | Result |
| --- | --- |
| `feat/m0-m1-availability-20261027` (`4d70648`, handoff `22370c8`) | Present; built on; baseline re-verified below |
| Codex commits `bfe7fb4`, `97d4f71`, `c13e571`, `e02337b` | **Unavailable** (`git cat-file` fails; no ref contains them). Their behaviour was NOT integrated; the equivalent requirements were implemented independently (M0 behaviours already existed; pricing/billing brief rewritten here) |
| `docs/mobile/CODEX_REVIEW_2026-10-27.md`, Codex `docs/ACCOUNT_BILLING_PLAN.md` | Not present. A new `docs/ACCOUNT_BILLING_PLAN.md` was written from the directive |
| Remote `claude/new-session-kszaxl` | Still `90c3bab`; no `main` |

## Phase A — reconcile
M0 behaviours re-verified by existing regression tests (session generations, serialised storage, cache clearing, biometric arming, idempotent apply, keyboard-safe sheets, lean assets, non-bypass RLS role + migrator split). Dependencies: audit re-run. A narrow `@expo/cli>zod → 4.6.6` override was tried and verified (`expo export` android+ios+web, `expo config`, Jest all pass); vitest in `ui`/`api-client` moved to ^4.1.12 (39+2 tests pass). **Remaining: `node-forge` (high) under `apps/mobile > expo > @expo/cli`, no patched version, not suppressed; Expo CLI tooling, not in the bundle.** Nothing suppressed, no release-age policy changed. Pricing: `GET /v1/pricing` (employee free nationally, `charging_enabled:false`, no products) and `/estimate` (A$19 / 19 / 30 add-on / 49).

## Phases B–D — what exists
Models/migration `d04d303111e7` (invitations, conversations, messages, message_reports, talent_exposures, `block` preference, `invitations_enabled`), forced RLS on all five. Services `invitations.py`, `conversations.py`; routers `invites_employer.py` (membership-guarded), `inbox_candidate.py`. Employer web: composer on Find talent, Invitations (withdraw), Messages threads, report. Mobile: Inbox tab with unread badge, invitation detail (accept/decline/block, changed-terms review), conversation screen (idempotent send, report, end, block), cross-platform `ConfirmSheet`, deep links. Worker: expiry sweep. Details and limits: ADR-010.

## Test results (this checkout, this environment)
| Check | Result |
| --- | --- |
| API pytest (Postgres 16, runtime role without SUPERUSER/BYPASSRLS, Redis) | 164 passed |
| ruff, ruff format, mypy strict | pass |
| Mobile Jest / tsc / eslint | 169 passed / pass / pass |
| ui vitest, api-client vitest | 39 passed, 2 passed |
| Employer + web tsc, workspace eslint, prettier | pass |
| Playwright (real API+DB: web, mobile-web, availability, invitations) | 29 passed |
| Android + iOS Hermes export | pass (3.5 MB each; dist 8.4 MB). **An export is not an installable build or a device test** |
| Migration up/down/up | pass |
| `pnpm audit --prod` | 1 high (node-forge, above). Full audit: same single finding |
| **Not run / unavailable** | GitHub Actions (needs publication); Docker Compose; any real device or emulator; real push (no credentials); multi-process API instances; screen readers |

## Known limits
See ADR-010 and ADR-009. In short: a budgeted employer can still probe ≤200 people/day for free/not-free; hide/block match the employer record only; no moderation UI; no employer-side push; attachments deferred; message text is retained for the candidate after a block but removed with account deletion; a minimal report excerpt survives deletion (needs counsel); "suspended employer" is modelled as verification being revoked.

## Next smallest slice
1. Device pass using `docs/mobile/DEVICE_TEST_CHECKLIST.md`, then publication approval so GitHub Actions can run. 2. Database-enforced commitment overlap + `offered/held/confirmed` lifecycle (the original "later priority 1"). 3. Admin/support view for message reports and verification (reports are rows today).
