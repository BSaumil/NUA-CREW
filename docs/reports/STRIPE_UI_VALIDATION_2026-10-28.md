# Stripe and UI validation checkpoint

Application source: `58b512428324927a81ee36a0c3d6cd1c0857b1d7`.
PR: https://github.com/BSaumil/NUA-CREW/pull/2

Stripe sandbox integration is implemented and disabled until the owner's account is connected. No real or account-backed test payment has occurred. Employees remain free across Australia. Prices are A$19 for 14 days, A$30 for a five-day promotion add-on and A$49 for the combined new-ad product. No automatic renewal.

## Passing evidence

CI: https://github.com/BSaumil/NUA-CREW/actions/runs/40589598473

- 215 API/Python tests against PostgreSQL 16; forced RLS and separate schema/runtime roles.
- 211 mobile tests and 41 shared tests; workspace types, lint, formatting, both Next builds, Android/iOS Hermes exports and generated-contract comparison.
- 35 browser tests against the real API/database. Includes hiring, isolation, invitations, messages, availability/consent, native screen drafting, disabled-payment configuration, phone widths, light/dark and axe.
- Worker smoke and Python production dependency audit.

The overall CI run is red because its independent JavaScript security audit fails on node-forge <=1.4.0. pnpm rejected 1.4.1 as too recent under the existing 24-hour release-age rule. Do not bypass that rule or suppress the audit. A passing test run is not release approval.

## Seven screenshots

Download: https://github.com/BSaumil/NUA-CREW/actions/runs/40590572154/artifacts/12772974437

The package contains employee discovery, employer home, role details, pay disclosure, advertisement review, desktop billing and phone billing. Captures use fictional development accounts and the running API/database. They are browser captures of app screen code, not screenshots from physical Android/iPhone hardware. Retained by GitHub until 25 January 2027. The export workflow handles only selected PNGs, not session traces.

## Claude/Codex continuation instructions

1. Read CLAUDE.md, MASTER_BRIEF.md, BRAND_IDENTITY.md and STRIPE_SETUP.md. Keep employees free and AI deferred.
2. Inspect the workspace before syncing. The environment disconnected after local commit 9d88029, while unvalidated employer account changes were being edited in services/api/app/routers/account.py and employer.py. Those dirty changes are not in the saved PR. Preserve them before restoring/syncing; do not force-push or overwrite later remote work. The draft had not passed Ruff or database tests.
3. Complete and test employer ownership transfer and deletion. Require password reauthentication and an explicit action; transfer only to an active existing teammate; recheck current owner under locks; prevent deleting the last owner; preserve company hiring and financial records while removing the personal account and sessions. Use a consistent user-before-company lock order across membership creation, transfer and deletion. Do not mark this feature delivered from the interrupted draft.
4. Integrate production managed identity/recovery using approved provider configuration. The current password adapter is development auth. Do not claim production readiness from a non-default JWT secret alone.
5. Connect the owner's Stripe sandbox securely when provided; follow STRIPE_SETUP.md and run actual Checkout, signed webhook, duplicate-event, expired-hold and refund acceptance. Automated transport fixtures are not provider acceptance.
6. Resolve native advertising-purchase policy and any required store billing. Stripe Checkout currently exists only on the employer web portal. Review Apple's advertising-management/same-app boost rules and Google Play payment rules before submission; do not assume an exemption.
7. Run physical-device keyboard, large-text, screen-reader, secure-storage, biometrics, push, sharing and connection-recovery checks. Earlier Android debug and unsigned iOS Simulator builds succeeded in run 40545258068; later native rebuilds were still running at this checkpoint. These are not store releases.
8. Finish staffing check-in/no-show operations, business closure and retention decisions, operational reconciliation and release configuration. The implemented shift scope covers booking, conflicts, cancellations and timesheets.
9. Re-run the security audit after a permitted patch installation. Keep PR #2 draft until required checks and release gates are resolved. Do not deploy, enable live billing or submit stores without authorization.

Official references:
- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/webhooks/signature
- https://docs.stripe.com/refunds
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9858738
