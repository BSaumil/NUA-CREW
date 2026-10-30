> Updated Stripe status: the interrupted billing work was restored and implemented in PR #2. See `../STRIPE_SETUP.md` and the newest implementation-tracker entry. Statements below about unpublished billing describe the earlier checkpoint, not the current source. No account-backed Stripe transaction or production activation has occurred.

# NUA CREW — hiring validation and shift delivery

Date: 28 October 2026 (Australia/Melbourne).
Branch: `feat/hiring-acceptance-shifts-20261028`.
Draft PR: https://github.com/BSaumil/NUA-CREW/pull/2

## Implemented and saved

- Complete persisted hiring journey test: employer registration and verified job publication, candidate application, employer review, accepted invitation and two-way messages. Other businesses and other candidates are denied access.
- Real PostgreSQL 16 validation through GitHub Actions, using separate migrator/runtime roles and forced RLS. A direct GiST race can legitimately abort with an exclusion error or deadlock; the test now requires exactly one persisted confirmation. A separate API race verifies a clear 409 response.
- Shift creation from a verified employer's published hourly-pay job, explicit time zone, disclosed fixed hourly rate within the job range and capacity of 1–50.
- Offers through accepted temporary-work conversations. Invitations and offers alone do not reserve a worker. Candidate acceptance atomically checks remaining capacity and confirmed commitments, then creates managed calendar work.
- Employee decline/cancellation, employer shift cancellation and calendar cleanup. Managed shift commitments cannot be removed through manual calendar controls.
- Actual-hours submission, breaks, versioned disputes/resubmission, employer approval and protection against silently amending approved hours. Timesheet review does not process wages.
- Candidate “My shifts and hours” and employer “Shifts and timesheets” screens, with confirmation sheets and real API operations. Local-time forms use the venue zone; skipped/repeated DST wall times are rejected instead of guessed.
- Candidate export includes shift/timesheet records, and erasure removes booking references before calendar data.
- Distributable-build guard against placeholder endpoints, bundle identifiers and EAS project configuration, with automated coverage.
- Browser coverage for native-screen job drafting, 320/390/430px widths, light/dark, axe and a short viewport with focused fields. Screenshots contain development fixtures and are internal CI artifacts, not device QA or production-user captures.

## Passing evidence

At source commit `a6b16b87d165f62bb23a796a8cbce2884aa7be6d`, CI run 40542772418 passed:

- **203 Python tests** against PostgreSQL, including RLS, full hiring journey, concurrency, shifts/timesheets and migration round trips.
- **206 mobile tests** and **41 shared tests**; workspace types, lint and formatting; both Next.js production builds; Android/iOS Hermes exports; OpenAPI regeneration comparison.
- API worker smoke and production Python dependency audit.

The subsequent release-build guard and current browser validation must be assessed using the latest PR checks; do not treat this earlier passing run as evidence for later source changes. The older browser run passed 27 tests and found two obsolete navigation expectations, which were corrected. The next run stalled while installing a browser. CI now uses the hosted runner's installed Chrome via Playwright's supported channel option and verifies its binary before testing. Local development still uses the default Playwright browser.

## Not complete / not enabled

- Physical Android/iPhone testing, native keyboard and 200% text, screen readers, secure storage, biometrics, sharing, push and real connection recovery on hardware. No Android SDK, Xcode or signing/store access is available here.
- Production managed identity, account verification and complete employer ownership-transfer/deletion handling. Local password auth remains a development adapter.
- Real checkout, provider-verified receipts/webhooks, billing ledger, promotion reservation inventory, paid publication enforcement, refund handling and promoted-search placement are **not delivered** by this PR. The catalogue remains non-purchasable.
- Employee access remains free nationally. Planned employer prices remain A$19/14 days and A$30/five-day promotion as an add-on, with a new promoted ad estimated at A$49. Five concurrent placements per local category must be reserved before selling promotion.
- The high-severity node-forge tooling advisory remains an independent failing security check. No suppression, relaxed release-age policy or removed test was used.
- Full staffing operations still need check-in/no-show handling, notifications, dispute operations, award/pay guidance and any payroll integration.

## Workspace interruption and recovery

The local execution environment disconnected after the saved mobile/shift commits. The authoritative saved work is on the PR branch. An unfinished local billing-domain draft (models, service and migration) had not been validated or published; do not count it as delivered. If that workspace returns, preserve and inspect its dirty files before deciding whether to continue that draft. Do not overwrite remote work or force-push local divergent history.

Continue by checking the latest PR jobs and fixing any failures. Restore a working development environment, then finish billing inventory/ledger with concurrency and RLS tests. Connect real provider sandbox accounts only when available; never expose a fake payment-success route. Production identity and native store builds require approved account/project configuration. Keep employees free and AI deferred.

## Provider and store references

- Apple review guidelines, including advertising/boost purchases: https://developer.apple.com/app-store/review/guidelines/
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Expo build setup: https://docs.expo.dev/build/setup/
- Playwright browser channels: https://playwright.dev/docs/browsers
- Hosted runner browser inventory: https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md

These references identify integration requirements; no store approval, payment-provider activation, legal compliance determination, production deployment or main merge is claimed.
