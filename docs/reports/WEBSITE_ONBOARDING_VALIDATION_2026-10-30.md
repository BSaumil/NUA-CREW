# Website reconciliation and guided onboarding — 30 October 2026

## Baseline and scope

Fresh clone, explicit branch from `origin/main` at `3be784999a282ac95e41f628f70b4fc0b77bf114`. The repository's default branch points to an older session branch, so it was not used as the baseline. Work branch: `feat/website-onboarding-validation-20261030`.

This change reconciles the currently deployed marketing website with current main, adds guided candidate/employer registration across web and shared Expo Android/iOS code, and adds registration regression checks. Existing Claude award, attendance, API, contracts and migration work is preserved. No API or migration files changed. The separate unmerged document/team/attendance bundle at 78e44db remains preserved; this branch does not claim to integrate its overlapping backend changes or certify that separate bundle against main.

## Changes

- Latest marketing pages, artwork, interactive feature guide, help and policies are now part of a normal Git branch based on main. Personal operator name and public technology messaging remain removed. Published business branding stays NUA POS / NUA AUS with the shared ABN and support contact.
- Marketing site explicitly uses its approved light palette. Product web/native themes retain their existing dark-mode support.
- Candidate signup: account details, then privacy choices and consent. Resume and profile setup come later; discovery is off by default.
- Employer signup: account details, business/location, then authority/terms consent. No purchase or verification is implied by account creation.
- Back navigation retains field values in component/page memory. No local storage or analytics added. Native submission locks prevent duplicate requests; original server actions and backend validation remain authoritative.
- Direct links to terms, privacy and employer terms before consent. Native policy-open failures give a usable address.
- Native registration tests preserve identity, password and explicit consent checks and now exercise back navigation. Shared web-component tests verify that Continue does not invoke registration and all fields are included only at final submission.
- New real-API browser registration scenarios added for both audiences; existing native-browser registration test updated to include the consent step. Site checks expanded to all 16 public pages and protect against reintroducing removed wording.

## Validation

New branch local checks:
- Workspace TypeScript: 8 packages passed.
- Workspace ESLint: 8 packages passed.
- Three Next.js production builds passed using the default build commands.
- Mobile: 228 tests, 34 suites passed.
- Shared UI: 41 tests passed, including 2 new guided-setup tests.
- API client: 2 tests passed in the workspace test run.
- Android and iOS Metro/Hermes bundle exports passed. These are compilation checks, not APK/IPA or device acceptance.
- Formatting and diff checks passed.

Database evidence, explicitly for the unchanged main baseline:
- GitHub CI run https://github.com/BSaumil/NUA-CREW/actions/runs/40895815550, exact main SHA above.
- API job 123524479280: 276 tests passed in 129.91 seconds. PostgreSQL 16, separate non-superuser runtime/migrator roles; RLS safety guard enabled.
- Browser job 123526266071: 45 tests passed in 3.3 minutes, covering hiring/application/invitation workflows and tenant boundaries against isolated PostgreSQL.
- All api/web/e2e/dependency-audit jobs completed successfully. This evidence was read from GitHub job logs, not rerun locally or invented from a mock database.

The local executor maps only UID 0 and has no PostgreSQL/container service. Native PostgreSQL cannot run here without bypassing its root guard; that was not done. New branch browser/PostgreSQL checks must run in isolated CI before claiming acceptance of the new registration scenarios. No SQLite or single-connection substitute is used for concurrency/RLS sign-off.

## Release boundaries

No public account registration or billing enabled, no product backend deployed, no native store submission, no production database touched. Current public marketing deployment remains pinned while the source is reviewed. A main merge and resuming automatic production assignment are separate release actions; this branch prepares the concrete source change and checks first.

## Publication blocker

The branch push to `https://github.com/BSaumil/NUA-CREW.git` was rejected by automatic approval review. Stated reason: publishing the 47-file source change to an external public repository and creating a persistent remote ref needs explicit approval for that destination. No alternative Git write path was attempted. No PR, main merge or new branch CI run was created.

The reviewed local source and Git bundle are ready. The new registration scenarios remain **unexecuted against PostgreSQL** until the exact branch is approved for publication and CI runs. The 276 API / 45 browser results above are evidence for main only, not the new branch.

## Owner approval — 30 October 2026

The owner approved publishing this branch to the public `BSaumil/NUA-CREW` repository, opening a pull request and merging it after successful checks. The earlier publication blocker above records the prior attempt; approval is now present. Fresh branch PostgreSQL/browser CI must pass before merging.
