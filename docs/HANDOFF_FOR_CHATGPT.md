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

**Verified on 2026-10-26:** 50 API tests, 41 vitest tests, 18 Playwright tests. `ruff`, strict `mypy`, `tsc`, `eslint`, `prettier` and both Next production builds are clean. `pnpm audit` and `pip-audit` report nothing.

| Area             | Delivered                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts         | Candidate and employer registration, Argon2id login, 30-minute JWT, login rate limiting (in-process)                                                                  |
| Employer         | Organisation with ABN checksum, owner/recruiter/viewer roles, locations, members, admin verification gate (publishing blocked until verified, audited)                |
| Jobs             | CRUD, structured pay (min/max/period/currency/super), versions, publish and close, public Postgres full-text search with filters                                      |
| Candidate        | Profile, skills, versioned text resumes, opt-in talent-discovery consent (default off, history kept)                                                                  |
| Matching         | Explainable estimate over skills, location, pay and preference; semantic, experience and trajectory shown as "not evaluated" and excluded from the score            |
| Applications     | One active application per job and candidate (partial unique index), idempotency key, withdraw and reapply, append-only event history (DB triggers), private employer notes hidden from candidates, rejection requires a human reason, in-app notifications |
| Isolation        | Guessed-ID negative tests for employer-vs-employer and candidate-vs-candidate, in the API and in the browser                                                           |
| Ingestion        | Source registry and permission grants, fixture connector, field-level permission filtering, repeat-safe runs, versioning, expiry of vanished listings, takedown, markup stripped, prompt-injection text inert, SSRF guard (unit-tested, no network connector yet) |
| Design system    | Burgundy/ivory/gold/teal tokens, light and dark, 12 components, axe plus WCAG AA contrast tests (light and dark)                                                      |
| Web apps         | Real pages against the API with httpOnly-cookie sessions through server actions                                                                                       |
| Tooling and docs | Makefile, GitHub Actions workflow, Docker Compose, ADRs 001–005, tracker, architecture, threat model, Australian legal-gate questions                                  |

## 4. What is NOT done or not verified

- Not started: mobile app (Expo), admin UI, job-edit UI, Career AI, pgvector and embeddings, resume file upload and malware scan, Local shifts, billing and entitlements, email/SMS/push, data export and deletion, Postgres RLS, queue/scheduler/workers.
- **Placeholder auth:** local password JWT for development only (ADR-002). No MFA, no refresh tokens, no email or phone verification. Do not use with real users.
- **Never run:** `docker-compose.yml` (no Docker daemon in the build environment) and the GitHub Actions workflow.
- **Brand assets:** SVGs in `brand/svg` are recreations of the supplied icon PNG, not official artwork. `docs/UI_COPY_AND_SCREENS.md` was never supplied.
- ABN: checksum only, no ABR lookup.

## 5. Ten next enhancements (priority order)

1. **Managed OIDC/PKCE auth with MFA for operators.** Replace the dev adapter in `app/security.py` and `app/deps.py`, add refresh and revocation, and email/phone verification. Needs an identity provider choice.
2. **Postgres Row-Level Security** on employer-scoped tables, plus a test that enumerates every employer route. This defends against any future query that forgets the tenant filter (ADR-003).
3. **First CI run and Docker verification.** Create the base branch and open a PR, fix whatever GitHub Actions and Compose reveal, and add SBOM and secret scanning.
4. **Redis-backed rate limiting and abuse controls.** Limits on applications and registrations, risk tiers, and a human appeal path.
5. **Job edit UI and employer workflow completion.** Edit and unpublish, interview scheduling, messaging, custom screening questions, and applicant filters.
6. **Resume upload pipeline.** Private S3-compatible storage, signed short-expiry URLs, size/type validation and malware scan before parsing, then parse-and-review so the candidate confirms extracted data.
7. **Durable ingestion pipeline (P2).** Scheduler, queue with retries, dead-letter and per-source throttling, an outbox, freshness re-checks, and cross-source dedupe that never merges on text similarity alone. Add the first real connector only once a signed licence exists.
8. **Hybrid search and embeddings.** Install pgvector, add a per-model embedding table with dimension and version, fuse full-text and vector with reciprocal rank fusion, and add an offline relevance set with Recall@K and NDCG. Keep hard eligibility gates ahead of similarity.
9. **Career AI (P3).** An LLM provider adapter with prompt versioning, structured output validation, and a PII-redacted usage ledger with cost caps. Features: resume tailoring with diffs and user approval (no fabricated claims), gap analysis, interview practice, and prompt-injection red-team tests.
10. **NUA CREW Local (P4) and billing (P5).** Shift tables, availability, offer/accept flow, and a concurrency-safe last-slot assignment with tests. Then plans, entitlements and Stripe sandbox with webhook replay and signature tests. Award-aware pay guidance and any labour-hire questions need counsel first.

Also queued: Expo mobile app (P6), admin portal UI, data export and deletion, notification channels, Storybook, observability (OpenTelemetry, Sentry with PII redaction).

## 6. Blockers that need the owner

Brand clearance · identity provider and credentials · ABN Lookup (ABR) access or a verification vendor · signed feed licences · LLM provider, key and budget · Stripe sandbox keys · Apple/Google developer access · counsel review of Privacy Act, Fair Work, labour hire, Spam Act and Consumer Law (see `docs/legal-launch-gates/AUSTRALIA.md`).

## 7. How to run

```bash
make install
make db-up              # Docker path is unverified; any Postgres 16 works
make migrate seed       # seed = fictional dev data, NUA_ENV=development only
make api web employer   # ports 8000 / 3000 / 3001
make check              # ruff, mypy, pytest, tsc, eslint, vitest, prettier
make e2e                # Playwright
```

Dev logins (password `nua-dev-password-1`, all `@nua-crew.example.com`): `owner-a`, `recruiter-a`, `viewer-a`, `candidate-a`, `owner-b`, `candidate-b`, `admin`.

## 8. Where to look

`docs/IMPLEMENTATION_TRACKER.md` (authoritative status) · `docs/MASTER_BRIEF.md` (owner's brief) · `docs/ADR/` · `docs/architecture/` · `CLAUDE.md` (invariants, each backed by a test).
