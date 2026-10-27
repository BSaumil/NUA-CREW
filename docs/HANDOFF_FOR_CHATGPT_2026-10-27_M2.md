# NUA CREW — Handoff for ChatGPT (after M2, 2026-10-27)

**Repo:** github.com/BSaumil/NUA-CREW · **Local branch (NOT published):** `feat/invitations-messaging-20261027` · chain: `90c3bab` (remote tip) → M0 `2e992c0`,`dae3c7a` → M1 `e7203d8`,`d3e3091` → docs `4d70648`,`22370c8` → M2 `e3f9abb`,`7b9b87e`,`ac59e72`,`2e5dd5f`. Nothing was pushed, no PR, no deploy/merge/purchase/scraping/live billing, and no real invitation or message was sent. Another checkout cannot fetch these commits. The Codex commits `bfe7fb4 97d4f71 c13e571 e02337b` were unavailable here and were not integrated.

## Product and rules
NUA CREW (master brand NUA, always capitals): Australian permanent-job and temporary-work marketplace, Melbourne hospitality first; Android/iOS first; AI deferred. Employees free nationally on every platform (no SKU, no paywall). Employers: A$19/14 days ad, A$19 re-advertise, A$30/5 days promotion as an add-on (A$49 new ad + promotion; unconfirmed reading), top-five reserved inventory not for sale, no auto-renew, billing foundation only and **disabled**. Pay labels disclosed/estimated/not_disclosed; scores are estimates; verified ≠ endorsement; humans decide; third-party data untrusted. Never claim the name/domain/trademark is cleared. See `CLAUDE.md`.

## Done (with evidence: 164 API, 169 Jest, 29 Playwright, ui 39 + api-client 2 vitest; ruff, mypy strict, tsc, eslint, prettier clean; Android+iOS Hermes exports OK)
- **Foundation:** FastAPI/Postgres 16 with forced RLS, run as a non-superuser runtime role with a separate migrator (ADR-008); Redis rate limits; durable ingestion queue; rotating refresh tokens; Expo candidate app; Next.js candidate + employer apps; design system.
- **M0 stabilisation:** session generations, serialised secure storage with truthful delete failures, caches cleared on every sign-out, biometric lock before restore, idempotent apply retries, keyboard-aware screens/sheets, share links, lean assets.
- **M1 availability:** permanent/temporary/both preferences, weekly windows (multiple/day, overnight), exceptions (unavailable wins), commitments, `unknown` never `available`, Melbourne DST tested, prefer/hide/mute, per-kind discovery consent, verified-employer talent search returning a privacy whitelist (ADR-009).
- **M2 invitations and messaging (ADR-010):** invitations with terms snapshot+hash, atomic quotas, decline cooldown, idempotency, row-lock lifecycle (pending→accepted/declined/withdrawn/expired), expiry on read/action/worker sweep, changed-terms review, one conversation per acceptance, plain-text paged idempotent messages, block/report/end, generic push text, 200-people/day discovery budget, export/deletion coverage; candidate Inbox tab, invitation and conversation screens; employer composer, sent list with withdraw, message threads; `GET /v1/pricing` + `/estimate`.

## Left (honest list)
**Needs the owner:** approval to publish (so GitHub Actions can run), Apple/Google accounts + EAS project, push credentials, brand clearance/bundle ids, identity provider, counsel review (discovery notice, report-excerpt retention, Privacy Act, Fair Work, labour hire, Spam Act, Consumer Law), confirm the A$30 add-on reading, GST/tax and channel product setup.
**Unverified here:** any real iPhone/Android device (keyboard, large text, VoiceOver/TalkBack, Keychain/Keystore, biometrics, share sheet, push, deep links) — use `docs/mobile/DEVICE_TEST_CHECKLIST.md`; GitHub Actions and Docker Compose never run; quotas tested with concurrent requests on one server, not multiple instances; push tested only with a fake provider.
**Open dependency finding:** `node-forge` (high) under `apps/mobile > expo > @expo/cli`, no patched release, deliberately not suppressed (tooling, not shipped); CI audit gate stays red until Expo updates. The `@expo/cli>zod` override and vitest 4 upgrade resolved the other findings.
**Not built:** native employer app; email/SMS; attachments; moderation/support UI (reports are rows); employer-side push; DB-enforced commitment overlap and offered/held/confirmed lifecycle; shifts/bookings; billing beyond the disabled catalogue; OIDC/MFA; admin portal; resume upload+scan; embeddings/hybrid search; real feed connector; observability.

## Known privacy limits
Free/not-free probing is narrowed (200 distinct people/day/employer) not removed; hide/block match the employer record only; no anonymity is claimed; a minimal report excerpt survives account deletion; "suspended employer" = verification revoked.

## What I would do next (priority)
1. Publish (with approval) and let CI run; run the device checklist on one iPhone and one Android phone.
2. Commitment overlap constraint (`btree_gist` via an admin step) + offered/held/confirmed with expiry, before any shift booking.
3. Support/admin UI for message reports and employer verification.
4. Production identity (OIDC + MFA) and secret/role management.
5. Native employer mode, then sandbox billing (idempotent, audited), then reserved top-five inventory with real concurrency control.
6. Award-aware pay guidance with reviewed sources and explicit "unsupported" states.

## Where to look
`docs/reports/M2_INVITATIONS_REPORT.md` · `docs/IMPLEMENTATION_TRACKER.md` (authoritative) · `docs/ADR/008–010` · `docs/ACCOUNT_BILLING_PLAN.md` · `docs/mobile/` · run: `make install db-up migrate seed api`, `make check`, `make e2e`.
