# NUA CREW native hiring — M4 implementation and handoff

Date: 27 October 2026. Branch: `feat/native-hire-experience-20261027`. Base: integrated M3 commit `bc13609679f80ac523b6f51c59e29176b5a7b0be`.

## Delivered in source

The same Android/iOS app now supports candidate and employer sessions, with separate role-protected navigation. Employer registration requests a rotating mobile refresh session; web registration defaults remain unchanged. Operator accounts continue to use the web support workspace.

Employers have four tabs: Jobs, Find people, Inbox and Business. The hiring dashboard shows actual job totals, filters and next actions. A venue setup gate precedes a first draft. Job creation has Role, Pay and Review steps, explicit super disclosure, optional hours/dates/skills and separate save/publish actions. Employers can edit, publish, pause and close jobs, review applicants and their resume snapshots, and progress the ATS with explicit confirmation and rejection reasons. Verification gates and backend permissions remain enforced.

Talent search supports permanent/temporary intent, skills, suburb and an optional work window. Discovery remains consent-based, without exposing private pay floors or calendars. Employers can send real invitations, withdraw them, and exchange paginated text messages in conversations created by accepted invitations. Retry keys remain stable for invitation/message payloads. Conversation reports and closed/read-only states are exposed.

Business settings include membership-scoped business selection, venues, owner-only addition of existing employer accounts to the team, planned prices, theme, biometric lock, password change, export and session controls. Business switching remounts hiring tabs; queries and mutations are scoped by business. Employer data remains in memory and outside the public offline cache. Account export now cleans up its temporary private file, including share failures, and rejects a session change during preparation.

Employees now have five main tabs: Discover, Saved, Applications, Inbox and Profile. Discover has a stronger search header and horizontally scrollable quick filters; alerts remain accessible from Discover and Profile. The existing burgundy/ivory design system, light/dark themes, loading/error/empty states and accessible controls are reused. Text scaling permits up to 200%; physical-device accessibility and layout verification are still required.

The support portal's revoke-verification option now submits the supported `rejected` status instead of an invalid `unverified` decision.

## Commercial rules retained

- Employees join and apply free in every Australian state and territory. Future employee charging remains a roadmap option only.
- Planned employer prices: A$19 for 14 days; A$19 renewal; A$30 for five days of promotion as an add-on; A$49 for a new advertisement plus promotion.
- The catalogue is informational and non-purchasable. Current development publication is not paid entitlement enforcement. No top-five promise is sold before capacity reservation exists.
- AI remains deferred. Pay disclosures do not claim that a rate satisfies an award, classification or legal minimum. Industry/award guidance still requires authoritative data, provenance and review.

## Validation

Passing checks on this branch:

- `pnpm typecheck` and `pnpm lint`: all seven workspace packages pass.
- `pnpm --filter @nua-crew/mobile exec jest --runInBand`: 204 tests across 28 suites pass, including employer registration/role sessions, workspace isolation, job creation/ATS UI, form validation and export cleanup/session changes.
- Shared UI and API client Vitest: 41 tests pass (39 UI, two client).
- `pnpm --filter @nua-crew/mobile bundle:check`: Android and iOS Hermes exports pass.
- `pnpm --filter @nua-crew/employer build`: production build passes, including the support portal.
- Python Ruff lint/format and mypy pass; 19 isolated Python tests pass, including three new mobile employer registration schema cases.

Native exports are JavaScript/Hermes bundles, not installable APK/IPA builds or device tests. Shared UI tests emit jsdom canvas/contrast warnings; they pass, but those warnings are another reason not to infer native visual accessibility from this run.

Database-backed employer mobile registration coverage was added but cannot run here: PostgreSQL is unavailable on localhost:5432. No database, RLS, migration, concurrency or real-API end-to-end pass is claimed for this change. Earlier Claude API/browser counts remain historical.

Browser visual inspection is blocked: no installed browser executable, and Playwright's official Chromium download failed with an invalid/truncated archive. The cloud browser did not reach this local preview. Rendering tests do not replace screenshot review on small phones, tablets, keyboard-open states and 200% text.

The existing Expo tooling node-forge advisory remains a release gate. The newly published fixed package is inside the configured minimum release age; no age-policy exception, audit suppression or weakened check was added.

## Next phases for Claude Code / Codex

1. **Integration acceptance:** restore PostgreSQL 16 with separate admin/migrator/runtime roles from the checked-in bootstrap; apply all migrations, seed development fixtures, run `make check` and `pnpm e2e`. Exercise employer mobile registration/refresh, two-business isolation and late responses, publication verification, applicant transitions, invitation acceptance/message/report flows and M3 commitment conflicts. Review clean upgrade/downgrade and existing-overlap behavior. Fix failures before calling M3/M4 complete.
2. **Device and UI acceptance:** run Android and iOS development builds on physical devices/emulators. Capture and review both roles at small widths, dark/light, keyboard open, 200% text and screen-reader navigation. Test secure storage, biometric lock, offline/reconnect, account switching, share-sheet cleanup and push behavior. Complete employer account closure/support handling and production identity/email verification. Current owner/recruiter/viewer membership controls add existing accounts; ownership transfer and a full invitation-onboarding system remain future work.
3. **Temporary-work lifecycle:** implement actual shift offers, explicit acceptance, capacity reservations, cancellation/no-show rules, time-zone/DST handling, check-in and timesheet/dispute flows. Reuse confirmed commitment overlap protection. Permanent/temporary availability and invitations already exist; they are not a completed staffing or payroll system. Add race, tenant-isolation and recovery tests for every booking transition.
4. **Billing sandbox:** ledger and RLS, signed idempotent webhooks, A$19 14-day entitlements/renewals, five-slot promotion inventory and fair placement semantics, A$30 five-day re-promotions, expiry, receipts/refunds and reconciliation. Confirm tax display and mobile store payment requirements with authoritative guidance before choosing checkout. Keep employee charges and live purchases disabled until separately authorized.
5. **Release hardening:** managed identity/MFA for privileged users, operational monitoring and recovery, required privacy/deletion/support flows, authorized feed provenance, dependency audit clearance, brand clearance and store packaging. Obtain separate approval for production deployment, live billing, main merge or store submission.

No production deployment, main merge, external messages, real invitations, paid actions or remote source push were performed in this implementation segment.
