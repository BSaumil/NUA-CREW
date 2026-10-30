# M0 + M1 implementation report (2026-10-27)

Branch: `feat/m0-m1-availability-20261027` (local only; **not pushed**, no PR, no deploy, no merge to main). Baseline `90c3bab`.
Commits: `2e992c0` (DB roles) · `dae3c7a` (mobile session/apply/bundle) · `e7203d8` (availability API) · `d3e3091` (screens, employer page, docs) · final report commit follows.

## Test evidence (this branch, this environment)
| Check | Result |
| --- | --- |
| API pytest (Postgres 16, runtime role without SUPERUSER/BYPASSRLS, Redis) | 140 passed |
| ruff, mypy strict | clean |
| Mobile Jest | 139 passed (19 suites); tsc + eslint clean |
| Playwright (web + mobile-web + new availability spec, against real API/DB) | 28 passed |
| ui vitest / api-client vitest | 39 / 2 passed |
| Android + iOS Hermes bundles | export OK (3.44 MB / 3.45 MB; was 3.71 MB); dist 15M → 8.3M |
| Migration `409867d9e7c2` | up/down/up, backfill test |
| `pnpm audit --prod` | **2 high, not suppressed** (below) |

## M0 outcome
Re-implemented (the Codex commits were unavailable) with regression tests: session generation binding, serialised credential writes with reported delete failures, caches cleared on every signed-out event, biometric lock armed before restore, stable idempotency key + double-tap block, keyboard-aware sheets and Screen, usable share links, only used fonts/icons, RLS tests under a least-privilege role with CI bootstrap and role guards (ADR-008), Redis dumps out of git.
Audit: `node-forge` (no patched release) and `zod` 3.x (fix only on 4.x) via `expo > @expo/cli` — dev tooling, not in the app bundle. Gate kept, so CI will stay red on this until Expo updates.

## M1 outcome
Acceptance items 1–8 and 10 done with tests; item 9 partial (see tracker). Design/privacy: ADR-009.

## Unverified on real devices / not done
Keyboard avoidance, TalkBack/VoiceOver, Keychain/Keystore, biometrics, push, share sheet, `toLocaleString` formatting of booked times, DST on a handset. GitHub Actions workflow and Docker Compose never run. Invitations/messaging, `offered` state, bookings, DB exclusion constraint for commitments not built. Counsel review of the discovery notice outstanding. No production role/secret management.

## Risks
Time-window search leaks one free/not-free bit per candidate per window (capped, rate-limited, audited). Hide-from is best effort. Refs derive from the JWT secret. CI audit gate red until Expo fixes the advisories.

## Next smallest slice
Consent-based invitation: an `invitations` table + candidate inbox and accept/decline, enabling the disabled invite explanation; then the `offered` state and a DB-level exclusion constraint.
