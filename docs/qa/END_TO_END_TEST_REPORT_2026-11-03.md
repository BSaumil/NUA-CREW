# End-to-end test report — 3–4 November 2026

Baseline `main` at `f10a55e`. "Ran" means executed in this session; "CI" means a green GitHub Actions run on the PR head that was merged. Stripe was deliberately skipped by the owner for now.

## Environments
| Environment | What it was |
| --- | --- |
| CI | GitHub Actions `e2e`, `api`, `web`, `dependency-audit`, `android-debug`, `ios-simulator` on #28 and #29 (all passed on the merged heads) |
| Local | PostgreSQL 16 with least-privilege roles, Redis, API from `main`, production builds of candidate and employer web, Expo web export of the mobile app, Chromium via Playwright |

## Results this session
| Run | Result |
| --- | --- |
| API suite on a freshly created database (#25 + #26 + #11 combined) | 357 passed |
| Full browser journey set against the local stack (marketplace, invitations, availability, hospitality, mobile web, mobile hire, onboarding, billing) | 25 passed, 2 failed (see defects) |
| Same two specs after resetting the database to empty | availability **passed**; invitations failed again, then **passed** after the test fix below |
| Database rebuilt from empty with `alembic upgrade head`, plus an upgrade of an older dev database from `b44c05ef1004` | both clean; single head `c55d06a11005` |

## Defects found
| # | Finding | Cause | Action |
| --- | --- | --- | --- |
| 1 | `invitations.spec.ts` "candidate blocks" failed locally: employer message list still showed the thread | **Test race, not a product defect.** The page was loaded right after the Block click; the API showed zero conversations a moment later. The block works | Test now polls the API until the thread is closed, then checks the page and API as before |
| 2 | `availability.spec.ts` failed on a reused database | **Stale state.** Consent was already On from an earlier run; it passed on an empty database | None needed; these specs are not re-runnable on one database. CI uses a fresh one |

No product defect was found in the journeys exercised.

## Handoff §13 matrix — coverage
| Case | Evidence | Status |
| --- | --- | --- |
| New AU employer signs up; verification required before publishing | `onboarding.spec.ts`; `test_unverified_employer_cannot_publish` | Covered (admin verification step is API-tested, not a browser flow) |
| Worker profile and availability / privacy | `availability.spec.ts`, `test_availability*.py` | Covered |
| AU employer posts a role with pay guidance; publish/edit/pause | `hospitality.spec.ts`, `marketplace.spec.ts` | Covered |
| Worker applies with private CV/RSA sharing | `test_document_vault.py` (API). Browser upload is **not** covered: uploads are disabled | **Not covered end to end** |
| Employer reviews, invites, messages | `marketplace.spec.ts`, `invitations.spec.ts` | Covered |
| Worker accepts invitation or shift; conflicts, duplicates, expiry | `invitations.spec.ts`, `test_shifts.py` | Covered |
| Check-in/out, correction, no-show, timesheet | `test_attendance.py`, `test_shifts.py` | Covered at API level; limited browser coverage |
| Stripe test-mode ad and promotion; failed payment | — | **Skipped by owner** |
| NZ preview: no active jobs, pay or billing | `country-ui.spec.ts`, markets tests | Covered |
| Future country under a disabled flag | `packages/markets` tests, `test_markets*.py` (unknown country fails closed) | Covered |
| Offline mid-application | `mobile-web.spec.ts` offline banner and cached results | Partly (no interrupted upload: uploads disabled) |
| Employer A probes Employer B | `test_rls.py`, `test_marketplace.py` | Covered |
| Revoke shared credential, download denied | `test_document_vault.py` | API only |
| Keyboard, screen reader, accessibility | axe in `accessibility.spec.ts`, `mobile-*.spec.ts`; no real screen reader | Partly |

## Not run / blocked
Real Android and iOS devices, large-text OS settings, real push, private storage and scanner, Stripe. CI's Android debug and iOS simulator builds prove the apps compile, not that they were used on a device.
