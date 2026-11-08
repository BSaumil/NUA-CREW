# NUA CREW — P0 sign-up and job-posting completion report (in progress)

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
