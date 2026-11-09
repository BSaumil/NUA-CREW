# Hosted pilot acceptance — 2026-11-09

**Result: NO-GO. The invitation-only AU hiring journey could not be verified against a protected
staging database, because the hosted API does not start and no project has any environment
variable configured.** No public flag was changed. No secret was read or printed. No access
control was bypassed (protected URLs were fetched only through the account-authorised Vercel
share-link tool).

## 1. Baseline
| Item | Value |
| --- | --- |
| `main` at start | `f5779d4e9eceb7b35a40df15435f08d192ae0d80` |
| Open PRs | #60 (docs), #48 (draft, security-gated, untouched) |
| `docs/pilot/readiness.json` | audience `invitation-only`, billing `disabled`, 11/11 gates `pending` (unchanged) |
| Vercel team | `team_U8hjJWj8ACvV3NUxbRIzBldT` |

## 2. Vercel inventory (production target, observed 2026-11-09 ~02:50 UTC)
| Project | Deployment | Commit | State | SSO protection | Env var names set |
| --- | --- | --- | --- | --- | --- |
| nua-crew-api | `dpl_B7W3TkPUWjfqzV1WreNTzCJPbYZu` | `f5779d4` | READY | on (all) | **none** |
| nua-crew-site (marketing) | `dpl_H3tVPVUFoSDRZxD4GsqoEfbiM2ED` | `f5779d4` | READY | on | not inspected |
| nua-crew-employer | `dpl_GxJdwc36QsfifAtbp3MWorumJi6P` | `c157c8a` | READY | on | **none** |
| nua-crew-candidate | `dpl_CHFi8EzgS9ENdenQjigajxULFB36` | `c157c8a` | READY | on | **none** |

Environment classification: all four are *production-targeted* deployments behind Vercel
Authentication. None is a public launch; none has an API base URL, database, JWT key, email or
Redis variable.

## 3. Route evidence (authorised fetch, no bypass)
| URL | Status | Classification |
| --- | --- | --- |
| API `/healthz` | 500 `FUNCTION_INVOCATION_FAILED` | **function crash at startup** (not an auth challenge, not 404) |
| API `/readyz` | 500 `FUNCTION_INVOCATION_FAILED` | same |
| API `/v1/jobs` | 500 `FUNCTION_INVOCATION_FAILED` | same |
| Candidate `/` | 200 | renders; title `NUA CREW Jobs — Where Talent Meets Opportunity`, H1 `Where Talent Meets Opportunity`, NUA CREW lockup |
| Employer `/` | 200 (serves `/login`) | renders; "NUA CREW Hire" |

Unauthenticated (no Vercel session) behaviour was not exercised: that would hit the Vercel
challenge by design and proves nothing about the app.

## 4. Findings
1. **P0 — API does not start.** Runtime logs show `Application startup failed. Exiting.` in the
   FastAPI lifespan, followed by
   `ImportError: cannot import name 'vc_handler' from 'vercel_runtime.vc_init'`
   and `Python process exited with exit status: 1`. The tail of the lifespan traceback is
   truncated by the log tool, so the exact raising line is **not confirmed**. Consistent
   explanation (inference): with no `NUA_DATABASE_URL` the app defaults to
   `localhost:5432`, and `assert_rls_safe_role()` (first statement in `lifespan`) cannot connect.
   The `vc_handler` ImportError (vendored `vercel_runtime` mismatch) is a separate suspect and
   needs a build-log check by the owner/ChatGPT.
2. **P0 — no environment variables on any app project.** Missing by name (all required for the
   API): `NUA_ENV`, `NUA_DATABASE_URL` (must be the `nua_runtime` role),
   `NUA_JWT_SECRET`, `NUA_CORS_ORIGINS`, `NUA_REDIS_URL`, `NUA_EMAIL_PROVIDER`, `NUA_EMAIL_FROM`,
   `NUA_EMAIL_API_KEY`. Web apps: the API base URL variable and (for protected previews) the
   protection-bypass secret name. Values were not read.
3. **P1 — region mismatch.** `services/api/vercel.json` requests `syd1`, but API invocations ran
   in `iad1` and `sfo1`. The candidate and employer apps show `iad1::syd1` in `x-vercel-id`,
   i.e. their functions did run in Sydney. **No Sydney API runtime may be claimed.** Likely
   cause is project-level function region settings overriding `vercel.json`; to be confirmed
   in Vercel project settings (owner).
4. **Positive:** registration, intro offer and Redis behaviour are fail-closed in code
   (`registration_gate`, `assert_shared_rate_limit`, `assert_rls_safe_role`), which is why the
   API refuses to boot without a safe configuration rather than serving unsafely.
5. No tenant leak, bypassable auth or unsafe DB privilege was observed (there is no database).

## 5. What was not run, and why
| Check | Status | Blocker (owner) |
| --- | --- | --- |
| Hosted candidate/employer registration, email verification | not run | API down; no email provider |
| ABN validation and employer verification | not run | API down; verification operator not named |
| Job draft/post, application, review, status update | not run | API down; no protected DB |
| Persistence after commit on hosted DB | not run | no Neon database |
| Negative suite on hosted stack (IDOR, RLS, Redis/email missing, concurrency, NZ-disabled) | not run | same |
| Browser UI at 320/390/desktop/dark, screen-reader names | not run on hosted | API down; screenshots need authenticated flows |
| Real Android/iOS device | not run | no devices; simulators do not satisfy the gate |
| Backup/restore, rollback rehearsal | not run | no database |

The repository's own suites (API pytest incl. RLS/IDOR/concurrency, Playwright real-gate on a
local Postgres) exist and run in CI; they are **not hosted acceptance** and are not claimed as such.

## 6. Owner dependencies to unblock (in order)
1. Create the Sydney Neon staging project; rehearse `docs/operations/NEON_ROLE_BOOTSTRAP.md` on a
   throwaway branch; run the first migration as `nua_migrator` from a protected context.
2. Set the API variables listed in finding 2 (sensitive), `NUA_ENV=staging`; leave registration
   flags closed or allowlisted to named test identities.
3. Provision shared Redis and an email provider with a verified sending domain.
4. Check the API build log for the `vc_handler` import error; align `vercel_runtime`/Python
   runtime; confirm function region setting is Sydney.
5. Provide approved synthetic test credentials / allowlist for the acceptance runner.

## 7. Rollback
No change was made to any deployment, environment variable, DNS, database or flag, so there is
nothing to roll back. Documentation only.

## 8. Gate status
`docs/pilot/readiness.json` is unchanged: no gate has genuine hosted evidence, so all remain
`pending` and `pnpm pilot:check <sha>` must keep failing.

## 9. CI
CI for this docs-only PR is recorded on the PR itself; main's CI at `f5779d4` was reported green
by the owner commit message but is not re-verified here.
