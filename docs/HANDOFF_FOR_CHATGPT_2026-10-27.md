# UPDATE (M2, same day): invitations and messaging are now built

Branch `feat/invitations-messaging-20261027` (local only, not published). **Read `docs/reports/M2_INVITATIONS_REPORT.md` first**: it has the commit list, the sources that could not be inspected (the four Codex commits are unavailable here), exact test results (164 API, 169 Jest, 29 Playwright), the one remaining audit finding (`node-forge`, unpatched, not suppressed) and everything unverified on devices. Sections 4–5 below are partly superseded: invitations/messaging are DONE (ADR-010); still NOT done: real-device validation, real push, native employer app, moderation UI, DB-enforced commitment overlap, billing (foundation only, disabled).

# NUA CREW — Handoff for ChatGPT (2026-10-27)

**Repo:** github.com/BSaumil/NUA-CREW · **Work branch (LOCAL, not pushed):** `feat/m0-m1-availability-20261027`, baseline `90c3bab`, head `4d70648`. Remote `claude/new-session-kszaxl` is still at `90c3bab`; there is no `main`, so no PR. No push, merge, deploy, purchase or scraping was done: the owner's plan did not grant them.

## 1. Product and non-negotiables
NUA CREW (master brand NUA, always capitals) is an Australian jobs and hiring platform, starting with Melbourne hospitality; Android and iOS are the priority, AI is deferred. Never claim the name, domain or trademark is cleared. Pay is `disclosed` / `estimated` / `not_disclosed`; match scores are estimates; "verified" is not endorsement; AI never makes hiring decisions; third-party data is untrusted; ingestion fails closed without a source permission. Full rules: `CLAUDE.md`.

## 2. Stack
pnpm + Turborepo; FastAPI + SQLAlchemy 2 async + Alembic + Postgres 16 (RLS) + Redis; Next.js 16 (`apps/web` candidate, `apps/employer` Hire); Expo SDK 58 / React Native 0.88 (`apps/mobile`); `packages/ui`, `contracts` (OpenAPI types), `api-client`; Playwright e2e.

## 3. What is DONE (with test evidence)
Earlier rounds: accounts and rotating refresh tokens, employer orgs and verification gate, jobs CRUD/search, candidate profile and resumes, explainable match estimate, applications with append-only history, two-layer tenant isolation (membership + forced RLS), ingestion queue/worker, design system, web apps, full candidate mobile app (discover, apply, saved searches, alerts, push adapter, export/deletion).

This round:
- **M0 stabilise:** session-generation binding (a late refresh can't resurrect or clear another account); serialised Keychain/Keystore writes with truthful delete-failure reporting; caches cleared on every sign-out; biometric lock armed before restore; idempotency key preserved on ambiguous retry and double taps blocked; keyboard-aware sheets/screens; working share links; only used fonts/icons (dist 15M → 8.3M); **RLS tests now run as a non-superuser, non-BYPASSRLS role** with migrator/runtime split, CI bootstrap, startup and pytest role guards (ADR-008); Redis dumps out of git.
- **M1 availability slice:** permanent/temporary/both work preferences (each kind keeps its own answers); weekly availability with several windows a day, breaks, overnight windows, dated exceptions (unavailable always wins), booked work (confirmed can't overlap; applications never reserve); "unknown" is never "available"; pure evaluator tested on Melbourne DST and a Saturday shift ending Sunday; prefer/hide/mute employer preferences; per-kind explicit discovery consent on top of the master switch; job engagement/duration/hours facets (employment_type kept, conservative backfill); verified-employer **talent search** returning a privacy whitelist (no pay floor, calendar, postcode or account id; per-employer opaque refs; unranked; pay fit only "compatible/not confirmed"; audited with who was shown; rate limited); 3 native screens + employer "Find talent" page; account export includes the new data. ADR-009.
- **Verification:** 140 API tests, 139 Jest, 28 Playwright, ui/api-client vitest, ruff/mypy/tsc/eslint clean, Android+iOS Hermes bundles export, migration up/down/up with backfill test.

## 4. What is LEFT
**Blocked on the owner:** push/PR approval; brand clearance and real bundle ids; Apple/Google accounts and EAS project; identity provider; ABN Lookup access; signed feed licences; counsel review (Privacy Act, discovery notice, Fair Work, labour hire, Spam Act, Consumer Law).
**Known failing gate:** `pnpm audit --prod` = 2 high under `expo > @expo/cli` (tooling, not shipped): `node-forge` (no patched version) and `zod` 3.x (fix only on 4.x). Deliberately not suppressed; CI audit step stays red until Expo updates.
**Unverified on real devices:** keyboard avoidance, TalkBack/VoiceOver, Keychain/Keystore, biometrics, push, share sheet, booked-time date formatting, DST on a handset. GitHub Actions workflow and Docker Compose have never run.
**Not built:** invitations/messaging (the UI says so; no fake Send button), `offered` state, shifts/bookings, DB exclusion constraint for commitments, admin UI, employer mobile app, resume upload + malware scan, embeddings/hybrid search, real feed connector, billing, email/SMS, OIDC/MFA, observability, production DB role/secret management.

## 5. What I think would improve it most (priority order)
1. **Real-device pass + CI first run.** Push (once approved), let GitHub Actions and Compose run, then test on one iPhone and one Android phone. Most remaining risk is here, not in features.
2. **Consent-based invitations.** `invitations` table, candidate inbox with accept/decline, push, audit; unlocks the employer page and makes discovery useful. Include rate limits per employer and per candidate to prevent spam.
3. **Database-enforced commitments.** Exclusion constraint (needs `btree_gist` created by an admin step) and an `offered` → `held` → `confirmed` lifecycle with expiry, so concurrency can't double-book.
4. **Production identity.** OIDC/PKCE with MFA for operators, email/phone verification, then retire the dev adapter (ADR-002).
5. **Fix the audit gate properly.** Track Expo SDK updates or pin patched transitive versions via overrides once `@expo/cli` supports them; add SBOM and secret scanning.
6. **Reduce the search side channel.** Add per-employer daily caps on distinct candidates seen, and k-anonymity style minimum result counts for time-window queries.
7. **Mobile quality.** Detox/Maestro device-farm tests, crash reporting with PII redaction, localisation hooks, tablet layouts, a calendar-style visual editor for availability instead of typed times.
8. **Admin portal** (verification queue, source permissions, dead-letter dashboard, audit viewer, takedowns) — all endpoints exist.
9. **Search quality.** pgvector + hybrid ranking with an offline relevance set, licensed gazetteer instead of the suburb centroid table.
10. **Later, only with owner decisions:** Career AI (with approval/diff UI and prompt-injection red-teaming), shifts marketplace and award-aware pay guidance (counsel first), Stripe sandbox billing.

## 6. Where to look
`docs/reports/M0_M1_IMPLEMENTATION_REPORT.md` · `docs/IMPLEMENTATION_TRACKER.md` (authoritative status) · `docs/ADR/008`, `009` · `docs/mobile/README.md` · `CLAUDE.md` · run: `make install db-up migrate seed api`, `make check`, `make e2e`.
