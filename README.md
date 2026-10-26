# NUA CREW

**Better Jobs. Stronger Teams.** — an AI-first Australian jobs marketplace and recruitment ecosystem, starting with Melbourne hospitality and local services.

> **Working identity.** "NUA CREW" has **not** been legally cleared (trade marks, ASIC, domains, handles). Nothing here claims availability or registration.

## Status — read this first

This is an early, real vertical slice, **not a launchable product**. Authoritative status: [`docs/IMPLEMENTATION_TRACKER.md`](docs/IMPLEMENTATION_TRACKER.md).

| Works today (tested)                                                                                            | Not built yet                                                           |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Employer registration, roles, admin verification gate, job create/publish/close                                 | Mobile app, admin UI, job edit UI                                       |
| Candidate profile, skills, text resumes, public search, explainable match estimate                              | Career AI, embeddings/pgvector, resume upload                           |
| One active application per job, append-only history, status pipeline, notifications (in-app)                    | NUA CREW Local (shifts), billing/entitlements, email/SMS/push           |
| Cross-tenant and cross-candidate isolation tests; permission-gated, repeat-safe fixture ingestion with takedown | Managed OIDC/MFA, RLS, data export/deletion, real feeds, queues/workers |
| Design system (brand tokens, 12 components) with axe + AA contrast tests, light/dark                            | Verified Docker Compose, CI run on GitHub                               |

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
make check   # ruff, ruff format, mypy, pytest (83; Redis tests skip if no Redis) · tsc, eslint, vitest (41), prettier
make e2e     # Playwright (19): posting/apply/advance flow, edit+unpublish, isolation, axe (light+dark)
make worker  # ingestion scheduler + queue worker (or `make worker-once`)
```

## Layout

`services/api` FastAPI modular monolith · `apps/web` candidate web · `apps/employer` NUA CREW Hire · `packages/ui` design system · `packages/contracts` + `api-client` generated OpenAPI types and client · `brand/` tokens and icon · `docs/` architecture, security, legal gates, ADRs · `tests/e2e` browser tests.

## Guardrails

No production deploys, live billing, real scraping, or brand registration without separate approval. No credentials in the repo (`.env.example` holds development-only placeholders). Seed data is fictional. See [`CLAUDE.md`](CLAUDE.md).
