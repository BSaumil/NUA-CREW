# Independent verification of `main` (fc18d43) — 2026-10-28

Run from a clean checkout of `origin/main` with local Postgres 16 (runtime role without SUPERUSER/BYPASSRLS, separate migrator, `btree_gist` installed by an administrator as `db/roles/bootstrap.sql` requires) and Redis. This is the database-integration and browser run that the integration commit listed as outstanding.

| Check | Result on `main` | After this PR |
| --- | --- | --- |
| API pytest (real Postgres) | 191 passed | unchanged |
| API `unit_tests` (run with `PYTHONPATH=.`) | 19 passed | unchanged |
| ruff, ruff format, mypy strict | pass | pass |
| Mobile Jest / tsc / eslint | 204 passed / pass / pass | same |
| prettier, employer + web tsc | pass | pass |
| Playwright (real API + DB, web + mobile-web) | **27 passed, 2 failed** | **29 passed** |
| `pnpm audit --prod` | 1 high: `node-forge` (Expo CLI tooling, no patched release, not suppressed) | same |
| Not run | GitHub Actions, Docker Compose, real devices, real push | same |

## What failed on `main`, and why
1. **Real bug: the Notifications screen was unreachable.** `(app)/_layout.tsx` hid the Alerts tab with `href: null`, which removes the route itself. The bell on Discover, notification taps (`routeFor` fallback) and `/alerts` all landed on Discover. Fixed by hiding only the tab button (`tabBarButton: () => null`).
2. **Stale e2e:** the browser test still clicked an "Alerts" tab (navigation was simplified) — now uses the bell.
3. **Stale e2e:** "signing in as an employer is refused" no longer holds because employers now use the native hiring workspace — the test now asserts they land there and get no job-seeker tabs.

## Setup note
Databases created before the commitment-overlap migration need `CREATE EXTENSION btree_gist` run by an administrator (`db/roles/bootstrap.sql`); otherwise the migration stops with a clear message.
