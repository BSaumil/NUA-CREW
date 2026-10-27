# NUA CREW — Claude review and mobile reliability improvements

Date: 27 October 2026. Reviewed remote baseline: `90c3babd1282b25aa0470d664bb40445cba0a42d` on `claude/new-session-kszaxl`, nine commits after the earlier `58caa1c` handoff. Work branch: `feat/mobile-session-resilience-20261027`.

## Current product instruction

Android and Apple iOS are the priority. AI features remain deferred. Keep the existing candidate app and backend; extend them rather than replacing them. The existing deterministic match estimate is not an AI service and remains labelled as an estimate, never a hiring probability.

## Claude's work inspected

The repository now contains the Expo Router candidate app, refresh-token rotation, bookmarks and saved searches, notifications and push adapter, account export/deletion, near-me search, employer job edit/unpublish, Redis rate limiting, forced Postgres tenant policies and the durable ingestion worker. These were inspected in source; the earlier handoff's test counts are historical evidence, not a substitute for checks in this review.

## Fixes and enhancements

| Finding | Result |
| --- | --- |
| A refresh completing after logout could sign the old account in again | Session generations invalidate old work immediately; late success and failure cannot alter another session |
| A delayed request could refresh/retry under a newly signed-in account | Requests are bound to their original generation; stale 200 and 401 responses are discarded before exposing data or retrying |
| Token writes could complete after local sign-out | Secure-store operations are serialised and checked against the session generation; access is published only after persistence succeeds |
| Secure-store deletion failures were silently treated as success | Memory clears immediately, but a device-storage failure is reported accurately; optional push cleanup cannot prevent local sign-out |
| A rejected refresh did not clear the private query cache through the auth listener | Every signed-out event clears queries; the biometric overlay is set before cold-start refresh can publish a signed-in state |
| Mobile applications did not send an idempotency key | Unchanged submission retries reuse a key; changed payloads have distinct intents; rapid duplicate presses are blocked |
| Apply sheet could be obscured by a small-screen keyboard | The sheet now avoids the keyboard and scrolls; native device verification remains required |
| Share action sent only prose | Shared job text includes the configured NUA CREW job app link |
| Font and icon barrel imports exported unused font assets | Imports target only the five typography weights and Ionicons actually used; exported asset count falls from 77 to 39 |
| CI connected as the Postgres container's initial superuser | Disposable CI bootstrap creates a separate NOSUPERUSER/NOBYPASSRLS application role; a regression test rejects bypass roles. This owner role is subject to FORCE RLS; production still needs a separate non-owner runtime/migration privilege model |
| A generated Redis snapshot was committed | Removed `services/api/dump.rdb` and ignored future Redis snapshots |
| Lockfile failed the environment's package-age policy | Resolved it with compatible TanStack 5.104.x, strict age enforcement and no age exemptions; pinned pnpm to the toolchain used here |

The superuser CI finding follows PostgreSQL's documented behaviour: superusers and BYPASSRLS roles ignore row security, including forced policies. See [PostgreSQL 16 row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html).

## Verification in this workspace

- 90 mobile Jest tests pass across 14 suites, including logout/refresh races, account switching, storage failures and ambiguous application retries.
- 41 existing shared UI/API-client tests pass: 131 JavaScript tests total.
- All seven workspace TypeScript checks and ESLint tasks pass.
- Both Android and iOS Hermes exports pass; both existing Next.js production builds pass.
- Backend Ruff and strict mypy pass; generated OpenAPI/contracts remain unchanged after regeneration.
- Dependency install passes the package-age policy. No ignored advisory or exemption has been introduced.

Warnings from jsdom's missing canvas and one existing Discover test's React act timing are not native accessibility or device-test evidence.

## Dependency audit: release gate still open

The production dependency audit found two high advisories in Expo tooling. The Zod dependency is upgraded through a narrow `@expo/cli>zod` override to patched 4.6.6. The remaining `node-forge` advisory has no published patched release (latest registry release 1.4.0 at review time): [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). It is reached through Expo CLI code-signing tooling; no claim is made here about exploitability in the shipped native app. The audit gate remains enabled and should continue to fail until remediation is available. Do not represent this branch as release-ready or audit-clean.

## Not verified / next steps

This environment has no running Postgres/Redis, Android SDK, iOS simulator or Xcode. The baseline's 102 API tests and 27 browser tests have not been rerun here. The new CI database bootstrap and role guard need a real CI/database run. Hermes exports are not APK/IPA builds, and native Keychain, biometrics, keyboard, push, app links and share sheet still need physical-device testing.

Next: run CI with the restricted DB role, resolve the unpatched tooling advisory, then produce internal Android and signed iOS builds using approved accounts and a reachable staging API. Employer mobile, interviews/messaging, resume file uploads and tablet layouts remain future non-AI enhancements. Managed identity and final store identifiers still need owner choices/access. No production deployment, main merge, billing or scraping is included.

## Publication status

The public repository and its ownership by the connected BSaumil account were verified. Automatic approval review nevertheless rejected the feature-branch push because it requires explicit authorisation for this source export. No remote feature branch or draft PR was created; CI has not run. The changes remain committed locally for review. The owner must explicitly approve pushing `feat/mobile-session-resilience-20261027` to `BSaumil/NUA-CREW` before publication is retried.
