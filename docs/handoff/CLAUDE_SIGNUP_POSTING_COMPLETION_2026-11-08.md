# NUA CREW — P0 sign-up and job-posting completion report (in progress: A done, B partly, C and D not started)

## PR A — marketing entry points

Launch flags (one source of truth: `packages/ui/src/launch.ts`). Each entry opens only when its own flag is exactly `true` AND its host is a valid https origin (http allowed on localhost). `NUA_PRODUCT_LIVE` never opens them.

| Entry | Flag | Host | Opens at |
|---|---|---|---|
| Create Free Employee Account | `NUA_CANDIDATE_SIGNUP_OPEN` | `NUA_APP_URL` | `/register` |
| Register Your Business | `NUA_EMPLOYER_SIGNUP_OPEN` | `NUA_HIRE_URL` | `/register` |
| Post a Job | `NUA_JOB_POSTING_OPEN` | `NUA_HIRE_URL` | `/jobs/new` (employer app sends signed-out people to `/login?next=`; `next` passes an exact allow-list, no open redirect) |

Closed (the default) goes to `/apps#job-seekers|#employers|#post-a-job`, which says registration is not open and payments are not switched on.

Screenshots: `docs/handoff/screenshots/p0a-home-390.png`, `p0a-home-desktop.png`, `p0a-menu-390.png`.

Not yet recorded here: merged SHA, deployed SHAs, Stage B-D results. Nothing is claimed live.

Merged: [#63](https://github.com/BSaumil/NUA-CREW/pull/63), squash commit `ffcfd558e310c8afaec9824d2a1cf3346309e32d` on `main`. CI on the exact merged head `ad577ee` was green: api, web, dependency-audit, e2e. The marketing site's production deployment for `ffcfd55` (`dpl_H6y2HU2Nbm9XoPqFDrPr9XvNUgg6`) is READY and aliased to iksaa.com.au. It was checked through the Vercel deployment URL because this sandbox cannot reach the real domain. The served page shows all three entry points as "Not open yet", links only to `/apps#job-seekers|#employers|#post-a-job`, contains no app/hire host URL, and is noindex.

Screenshots (final layout; the marketing site has no dark theme, so the dark captures match light): `screenshots/p0a-home-{320,390,1440}-{light,dark}.png`, `screenshots/p0a-menu-390-light.png` (taken on the earlier layout; the phone-menu entries are covered by the `site-entry-points` spec).

## PR B: protected hosting (partly done)

Audit of `nua-crew-candidate` and `nua-crew-employer` before this change: one production deployment each, both at stale SHA `c5236975`, no environment variables, no Git-driven deployments since.

Redeployed as **previews** (not production, no alias change, no env vars, SSO untouched):

| App | Deployment | Deployed SHA | State | Routes checked on the deployment URL |
|---|---|---|---|---|
| candidate | `dpl_RjcKAEpHrttdQkJVppbaSe7vKpmw` | `ffcfd558` | READY | `/login` 200 (real candidate login). `/jobs` 500 (see blocker). `/register` returned the real sign-up form on the stale build; not re-fetched on the new build. |
| employer | `dpl_6hR9uqJUFsPn5y5FaRVvaYQ5MWAR` | `ffcfd558` | build completed ("Deployment completed"; the state field lagged) | `/jobs/new` redirects to `/login?next=%2Fjobs%2Fnew` and the form carries `next=/jobs/new`. `/register`, `/jobs` not re-fetched. |

Fetched through the Vercel connector, which uses a temporary share link, so the SSO gate itself was not tested from outside.

**Blocker (not fixed, by design):** candidate `/jobs` fails with `TypeError: fetch failed` caused by `ECONNREFUSED 127.0.0.1:8000`. No `API_BASE_URL` is set, and no hosted API has passed a health check, so the apps fall back to localhost. I have not set it. Registration, login submit, job lists and posting cannot work on these previews. Needs: a hosted API with passing health and readiness checks, then a server-only `API_BASE_URL` set by the owner.

Not verified: project root directory and install/build settings as configured in Vercel (the builds succeed from the monorepo root, which suggests they are right).

Nothing here is live. No flag is open, and AWS, DNS, Stripe, production database and NZ transactions are untouched.
