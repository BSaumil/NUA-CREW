# NUA CREW

**Better Jobs. Stronger Teams.** — an AI-first Australian jobs marketplace and recruitment ecosystem, starting with Melbourne hospitality and local services.

> **Working identity.** "NUA CREW" has **not** been legally cleared (trade marks, ASIC, domains, handles). Nothing here claims availability or registration.

## Status — read this first

This is an early, real vertical slice, **not a launchable product**. Authoritative status: [`docs/IMPLEMENTATION_TRACKER.md`](docs/IMPLEMENTATION_TRACKER.md).

| Works today (tested)                                                                                                                                                                                                        | Not built yet                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Employer registration, roles, admin verification gate, job create / edit / publish / unpublish / close                                                                                                                      | Admin UI, employer mobile app                                                             |
| Candidate profile, skills, text resumes, public search (filters, pay floor, near-me, sort), explainable match estimate                                                                                                      | Career AI, embeddings/pgvector, resume file upload                                        |
| One active application per job, append-only history, status pipeline, notifications (in-app, opt-in push adapter)                                                                                                           | NUA CREW Local (shifts), billing/entitlements, email/SMS                                  |
| Tenant isolation at the app **and** Postgres row-level-security layers; Redis rate limiting; permission-gated fixture ingestion on a durable queue/worker (retries, dead-letter, throttle, circuit breaker, scheduler)      | Managed OIDC/MFA, real feeds, outbox/embeddings                                           |
| **Candidate mobile app** (Expo: iOS + Android): rotating refresh tokens, biometric lock, saved jobs/searches with alerts, apply/withdraw, data export, in-app account deletion — see [`docs/mobile`](docs/mobile/README.md) | Running on real devices, store builds/listings (owner accounts needed), messaging, shifts |
| Design system (brand tokens, 12 components) with axe + AA contrast tests, light/dark, shared with native                                                                                                                    | Verified Docker Compose, CI run on GitHub                                                 |

## Quickstart

Prereqs: Node 22, pnpm 10, [uv](https://docs.astral.sh/uv/), PostgreSQL 16. Details: [`docs/operations/LOCAL_SETUP.md`](docs/operations/LOCAL_SETUP.md).

```bash
make install
make db-up            # or point NUA_DATABASE_URL at any Postgres 16
make migrate seed     # seed = fictional development data only
make api web employer # run each in its own terminal (ports 8000 / 3000 / 3001)
make worker           # optional: ingestion scheduler/queue worker
```

## Checks

```bash
make check   # ruff, ruff format, mypy, pytest (102; Redis tests skip if no Redis) · tsc, eslint, vitest (41), jest (79, mobile), prettier
make e2e     # Playwright (27): web flows, edit+unpublish, isolation, axe light+dark · plus the mobile app's real screens vs the real API
make worker  # ingestion scheduler + queue worker + saved-search alerts + push (or `make worker-once`)
pnpm --filter @nua-crew/mobile bundle:check   # Metro/Hermes compile for Android and iOS
```

## Layout

`services/api` FastAPI modular monolith · `apps/web` candidate web · `apps/employer` NUA CREW Hire · `apps/mobile` candidate app (iOS/Android) · `packages/ui` design system · `packages/contracts` + `api-client` generated OpenAPI types and client · `brand/` tokens and icon · `docs/` architecture, security, legal gates, ADRs · `tests/e2e` browser tests.

## Guardrails

No production deploys, live billing, real scraping, or brand registration without separate approval. No credentials in the repo (`.env.example` holds development-only placeholders). Seed data is fictional. See [`CLAUDE.md`](CLAUDE.md).
