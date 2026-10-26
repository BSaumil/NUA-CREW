# Baseline audit

**Date:** 2026-10-26 · **Branch:** `claude/new-session-kszaxl` (designated session branch; the brief's suggested name `feat/nua-crew-foundation-*` was not used because the session was assigned this branch)

## Starting state

- `git status`: empty repository, no commits, remote `origin` → `https://github.com/BSaumil/NUA-CREW`.
- No existing README, manifests, tests, CI or source. Nothing to preserve; nothing from another product to protect.
- Decision: build NUA CREW in this repository (see `docs/DECISIONS_AND_BLOCKERS.md`).

## Toolchain found in the build environment

| Tool                       | Version                     | Notes                                                         |
| -------------------------- | --------------------------- | ------------------------------------------------------------- |
| Node / pnpm                | 22.22 / 10.28               |                                                               |
| Python / uv                | 3.13 / 0.11                 | API targets 3.12+                                             |
| PostgreSQL                 | 16.15 (local server)        | **pgvector extension not installed** locally                  |
| Redis                      | `redis-server` binary found | Not used by code yet                                          |
| Docker                     | CLI present                 | Daemon not available here; compose file is **untested** here  |
| Chromium + Playwright 1.63 | present                     | Used for e2e and browser accessibility checks                 |

## How to build and test (what actually runs today)

```bash
make install
cd services/api && uv run pytest -q       # 50 API tests against local Postgres (nua_crew_test)
pnpm typecheck && pnpm lint && pnpm test  # UI + client unit tests
pnpm e2e                                  # Playwright vertical slice + axe scans
```

## Gaps against the master brief

See `docs/IMPLEMENTATION_TRACKER.md` — it is the source of truth for status and evidence.
