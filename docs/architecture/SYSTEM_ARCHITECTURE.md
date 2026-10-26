# System architecture (as built)

```
Browser ──► apps/web (Next.js, :3000)      ─┐  server actions, httpOnly cookie
Browser ──► apps/employer (Next.js, :3001) ─┤
                                            ▼
                                  services/api (FastAPI, :8000)
                                            │  SQLAlchemy async + Alembic
                                            ▼
                                   PostgreSQL 16 (pgvector planned)
```

- **Modular monolith:** one FastAPI service, routers per domain (`app/routers`), domain logic in `app/services` (jobs, applications, matching, ingestion, url_guard). No separate workers yet.
- **Contracts:** FastAPI's OpenAPI → `packages/contracts` (generated, CI drift-checked) → `packages/api-client` (typed `openapi-fetch`).
- **Design system:** `packages/ui` — tokens, brand components, axe + contrast tests.
- **Transactions:** one DB transaction per request (`app/db.py:get_session`); writes that must surface constraint errors are flushed inside handlers.
- **Not built yet:** Redis use, queue/workers, object storage, embeddings, LLM adapter, maps adapter, Stripe, mobile app, admin UI, observability stack.
