# NUA CREW — Project handoff (paste into ChatGPT as context)

**Repo:** https://github.com/BSaumil/NUA-CREW · **Branch:** `claude/new-session-kszaxl` (no `main` exists yet, so no PR) · **Date:** 2026-10-26

## 1. What NUA CREW is

An AI-first Australian jobs marketplace and recruitment ecosystem, starting with Melbourne hospitality and local services. Master brand **NUA**, product **NUA CREW**. Tagline: _Better Jobs. Stronger Teams._ Sub-products: Jobs, Hire, Shifts, Talent, AI.

**Working name only:** "NUA CREW" is not legally cleared (trade marks, ASIC, domains, handles). Never claim availability.

**Non-negotiable product rules**

- Pay is always labelled `disclosed`, `estimated` or `not_disclosed`. Employers can only create `disclosed`.
- Match scores are explainable estimates, never hire probabilities.
- "Verified business" means identity reviewed, not endorsed.
- Humans make every hiring decision; AI never auto-rejects.
- Third-party data (feeds, resumes, listings) is untrusted data, never instructions.
- Ingestion fails closed without a recorded source permission. `robots.txt` is not authorisation.
- No production deploys, live billing, real scraping or brand registration without owner approval.

## 2. Stack

- **Monorepo:** pnpm + Turborepo (TypeScript), uv (Python).
- **API:** FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic, PostgreSQL 16 (pgvector planned).
- **Web:** Next.js 16 App Router, React 19. `apps/web` is candidate and public; `apps/employer` is NUA CREW Hire.
- **Shared packages:** `packages/ui` (tokens + 12 brand components), `packages/contracts` (OpenAPI-generated types), `packages/api-client` (typed `openapi-fetch`).
- **Tests:** pytest, vitest + vitest-axe, Playwright + axe-core.

## 3. What is DONE (all with passing tests)

**Verified on 2026-10-26 (after the mobile round):** 102 API tests (Postgres + real Redis), 41 vitest tests (design system + client), 79 Jest tests (mobile), 27 Playwright tests (19 web + 8 mobile screens against the real API). `ruff`, strict `mypy`, `tsc`, `eslint`, `prettier`, both Next builds and the Android/iOS Hermes bundles are clean.

| Area             | Delivered                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts         | Candidate and employer registration, Argon2id login, 30-minute JWT, Redis sliding-window rate limiting (auth, per-candidate applications, per-employer job creation) with in-process fallback if Redis is down |
| Employer         | Organisation with ABN checksum, owner/recruiter/viewer roles, locations, members, admin verification gate (publishing blocked until verified, audited)                |
| Jobs             | CRUD, structured pay (min/max/period/currency/super), versions, edit in place, publish / unpublish / close, public Postgres full-text search with filters; employer edit and unpublish UI |
| Candidate        | Profile, skills, versioned text resumes, opt-in talent-discovery consent (default off, history kept)                                                                  |
| Matching         | Explainable estimate over skills, location, pay and preference; semantic, experience and trajectory shown as "not evaluated" and excluded from the score            |
| Applications     | One active application per job and candidate (partial unique index), idempotency key, withdraw and reapply, append-only event history (DB triggers), private employer notes hidden from candidates, rejection requires a human reason, in-app notifications |
| Isolation        | Two layers. App: membership dependency, 404 on miss, guessed-ID tests in API and browser, test that fails if an employer route lacks a guard. Database: Postgres row-level security (forced) on 20 tables with per-request identity; tests run deliberately unfiltered SQL as anonymous / other employer / other candidate / privileged and assert what Postgres returns; cross-tenant writes only inside an explicit `system_scope` |
| Ingestion        | Source registry and permission grants (fail closed), fixture connector, field-level permission filtering, repeat-safe runs, versioning, expiry of vanished and stale listings, takedown, markup stripped, prompt-injection text inert, SSRF guard (unit-tested, no network connector yet) |
| Ingestion pipeline | Durable Postgres queue (SKIP LOCKED claims, lease reclaim after worker crash), exponential-backoff retries, dead-letter list with audited operator requeue, per-source throttle and single-flight advisory lock, circuit breaker, slot-keyed scheduler, atomic runs that roll back on failure, `python -m app.worker` (loop or `--once`), admin endpoints for schedule / enqueue / tasks / requeue / reset-circuit / stats (ADR-006) |
| Design system    | Burgundy/ivory/gold/teal tokens, light and dark, 12 components, axe plus WCAG AA contrast tests (light and dark)                                                      |
| Web apps         | Real pages against the API with httpOnly-cookie sessions through server actions                                                                                       |
| Mobile app (`apps/mobile`, Expo/React Native, iOS + Android) | Candidate app: onboarding, sign-in/up, **rotating refresh tokens in Keychain/Keystore**, biometric app lock, Discover (search, filters, pay floor, **near-me with coarse rounded location never stored**, infinite scroll, offline read of public jobs), job detail with Overview / My match / Company, apply with resume + note, external-job disclosure, saved jobs, **saved searches with hourly-capped alerts**, applications timeline + withdraw, alerts inbox, push (opt-in, adapter off by default), profile strength + resumes, theme override, data export, **in-app account deletion**. Backend additions: refresh-token rotation with reuse detection, saved jobs/searches, device tokens, alerts + push worker steps, export/deletion, password change, CORS PATCH. Docs: `docs/mobile/README.md`, ADR-007, store privacy draft |
| Tooling and docs | Makefile, GitHub Actions workflow, Docker Compose, ADRs 001–005, tracker, architecture, threat model, Australian legal-gate questions                                  |

## 4. What is NOT done or not verified

- Not started: admin UI, employer mobile app, Career AI, pgvector and embeddings, resume file upload and malware scan, Local shifts, billing and entitlements, email/SMS/push, data export and deletion, transactional outbox, bot challenges / risk-tiered limits, any real feed connector.
- **RLS caveat:** in development the app connects as the table owner (policies use FORCE). Production must connect as a non-owner, non-superuser role.
- **Placeholder auth:** local password JWT for development only (ADR-002). No MFA, no refresh tokens, no email or phone verification. Do not use with real users.
- **Mobile not run on a real device or emulator** (this environment has no Android SDK and cannot build iOS): verified by typecheck, Jest, Metro bundles for both platforms, prebuild config audit and a browser run of the same screens against the real API. Keychain/Keystore, biometrics, push delivery, location prompt and share sheet are untested on hardware. Store builds need Apple/Google accounts and a cleared brand/bundle id.
- **Never run:** `docker-compose.yml` (no Docker daemon in the build environment) and the GitHub Actions workflow.
- **Brand assets:** SVGs in `brand/svg` are recreations of the supplied icon PNG, not official artwork. `docs/UI_COPY_AND_SCREENS.md` was never supplied.
- ABN: checksum only, no ABR lookup.

## 5. Ten next enhancements (priority order, revised after the mobile round)

Already completed: Postgres RLS, Redis rate limiting, job edit/unpublish UI, durable ingestion queue/worker, candidate mobile app (iOS + Android) with its backend.

1. **Real-device validation and store pipeline.** Run the app on physical iPhone and Android devices (biometrics, Keychain/Keystore, push, location, share sheet), create the EAS project, build internal-test binaries (TestFlight / Play internal), register real bundle ids once the brand is cleared, and have counsel review `docs/mobile/STORE_PRIVACY_DRAFT.md`. Needs owner accounts.
2. **Managed OIDC/PKCE auth with MFA for operators.** Replace the dev adapter (`app/security.py`, `app/deps.py`; RLS identity binding stays), add email/phone verification. Needs an identity provider choice.
3. **First CI run and production-like DB role.** Create the base branch and open a PR, fix whatever GitHub Actions and Compose reveal (workflow now includes Postgres, Redis, worker smoke and mobile bundle check), run the API as a non-owner DB role to prove RLS, add SBOM and secret scanning.
4. **Admin portal UI** (`apps/admin`): employer verification queue, source/permission management, task and dead-letter dashboard, audit viewer, takedown. All endpoints exist.
5. **Messaging and interview scheduling** across employer web and the mobile app (threads, push, calendar invites), plus employer team invitations by email and custom screening questions.
6. **Resume upload pipeline.** Document picker/camera scan, private S3-compatible storage with signed URLs, malware scan before parsing, parse-and-review so the candidate confirms extracted data.
7. **Embeddings and hybrid search.** pgvector, per-model embedding table, transactional outbox from ingestion, reciprocal-rank fusion with full-text, offline relevance set (Recall@K, NDCG); replace the approximate suburb centroid table with a licensed gazetteer.
8. **First real connector.** Only with a signed licence: hardened network fetcher (timeouts, size limits, `assert_safe_url`), per-source rate limits, cross-source dedupe that never merges on text similarity alone, OpenTelemetry/Prometheus metrics.
9. **Career AI (P3).** LLM adapter with prompt versioning, structured-output validation, PII-redacted usage ledger and cost caps; resume tailoring with diffs and approval, gap analysis, interview practice, prompt-injection red-team tests.
10. **NUA CREW Local (shifts) and billing.** Shift tables, availability, offer/accept, concurrency-safe last-slot assignment with tests, Stripe sandbox plans/entitlements, ghost-job risk indicators, award-aware pay guidance (counsel first).

Also queued: employer mobile app, native FCM/APNs push adapter (to avoid a third-party processor), Storybook, observability (OpenTelemetry, Sentry with PII redaction), device-farm UI tests, localisation beyond en-AU, https universal/app links (needs a cleared domain).

## 6. Blockers that need the owner

Brand clearance · identity provider and credentials · ABN Lookup (ABR) access or a verification vendor · signed feed licences · LLM provider, key and budget · Stripe sandbox keys · Apple/Google developer access · counsel review of Privacy Act, Fair Work, labour hire, Spam Act and Consumer Law (see `docs/legal-launch-gates/AUSTRALIA.md`).

## 7. How to run

```bash
make install
make db-up              # Docker path is unverified; any Postgres 16 + Redis works
make migrate seed       # seed = fictional dev data, NUA_ENV=development only
make api web employer   # ports 8000 / 3000 / 3001
cd apps/mobile && pnpm start   # Expo (see docs/mobile/README.md)
make worker             # ingestion scheduler + queue worker
make check              # ruff, mypy, pytest, tsc, eslint, vitest, prettier
make e2e                # Playwright
```

Dev logins (password `nua-dev-password-1`, all `@nua-crew.example.com`): `owner-a`, `recruiter-a`, `viewer-a`, `candidate-a`, `owner-b`, `candidate-b`, `admin`.

## 8. Where to look

`docs/mobile/README.md` (mobile app) · `docs/IMPLEMENTATION_TRACKER.md` (authoritative status) · `docs/MASTER_BRIEF.md` (owner's brief) · `docs/ADR/` · `docs/architecture/` · `CLAUDE.md` (invariants, each backed by a test).
