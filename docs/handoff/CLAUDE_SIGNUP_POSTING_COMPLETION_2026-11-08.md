# NUA CREW — P0 sign-up and job-posting completion report (A, C and D merged; B partly done)

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

## PR C: end-to-end journey on the shipped gates (merged)

[#66](https://github.com/BSaumil/NUA-CREW/pull/66), squash commit `37bc5ac37fc71c41a3b46c3cb847925b876cf295`. CI on the exact tested head `46330bd` was green: api, web, dependency-audit, e2e, and the new `e2e-real-gate` job (about 1.5 minutes on its first run).

The run uses `tests/e2e/playwright.real-gate.config.ts`. The API runs on the shipped defaults (verified email and role-on-publish both on; the file mail transport is what turns the email gate on). The marketing site is built with all three launch flags open toward the local apps, so every leg starts from a marketing call-to-action click. Real web apps, real API, real Postgres with RLS.

Journey asserted end to end: Create Free Employee Account, then candidate sign-up; Register Your Business, then employer sign-up with a checksum-valid unique ABN; the workspace says it cannot publish (an ABN checksum is not verification); an operator verifies the business with recorded evidence; Post a Job, then the guided hospitality flow with a pay check; with the employer's email unconfirmed the shipped gate refuses to create the ad (not only to publish it) with "Verify your email address first"; after confirming the email the same flow saves a draft with its pay check and publishes; the candidate sees "Verified business", is refused until their own email is confirmed, then applies; the employer sees the application and starts a review; the candidate sees "Under review".

## PR D: negative scenarios (merged)

[#67](https://github.com/BSaumil/NUA-CREW/pull/67), squash commit `bb78d5101c8312cddea82ecc3307d18dbbe90858`. CI on the exact tested head `bb49a7a` was green: api, web, dependency-audit, e2e and e2e-real-gate. 11 tests with real HTTP codes, each refusal paired with a valid-request control: consent missing or false (422), weak password (422), `NZ` country (422), duplicate email (409), duplicate ABN (409), missing ABN and bad checksum (422), talent discovery consent defaults to OFF, another business gets 404 on a business's jobs (owner gets 200), a candidate account gets 404 and an anonymous caller 401, an unconfirmed email gets 403 on job creation, and hostile `next` values (`https://evil.test`, `//evil.test`, `/\evil.test`, encoded CRLF, `javascript:`) all fall back to `/`.

## Production state (checked through the Vercel deployment URL; the sandbox cannot reach the real domain)

`nua-crew-site` production deployment `dpl_7A3hKfc94AhQg5yQH3tEcwSnAbhQ` is READY at `main` `37bc5ac`. Served page: header has no App status; footer has App status directly after Help & FAQs; no link to an app or hire host; entries read "Not open yet"; noindex.

## Done versus blocked

| Item | State | Proof |
|---|---|---|
| Three first-class CTAs, granular launch flags, honest closed states | Done, live on the marketing site | #63 `ffcfd55`, CI green on `ad577ee`, production READY |
| Open-redirect guard on sign-in return path | Done | unit tests in #63; hostile-`next` cases in #67 |
| App status moved to the footer | Done, live | #65 `4018d7e`, CI green on `13ac573`, production READY |
| Candidate and employer apps redeployed from `main` as previews | Done as previews only | `dpl_RjcKAEpHrttdQkJVppbaSe7vKpmw`, `dpl_6hR9uqJUFsPn5y5FaRVvaYQ5MWAR` at `ffcfd558`; SSO and production aliases untouched |
| Registration, login, job lists and posting on those previews | **Blocked** | no hosted API has passed a health check; no `API_BASE_URL`; candidate `/jobs` returns 500 (`ECONNREFUSED 127.0.0.1:8000`) |
| Full journey on shipped gates, locally | Done | #66 `37bc5ac`, `e2e-real-gate` green |
| Negative scenarios | Done | #67 `bb78d51`, `e2e-real-gate` green |
| Email delivery | **Blocked** | no approved provider; local file transport only |
| Operator verification of award rates inside the journey | Not covered | pay check uses `supplied_unverified` rates; `rate-verification.spec.ts` covers the operator flow separately |
| Candidate profile completion and password reset inside the journey | Not covered here | password reset and email verification have their own specs |
| Connection outage, double-submit, missing pay check via API, unverified-business publish via API | Not covered in the real-gate suite | stated in #67's description |
| Android and iOS onboarding parity, physical-device proof | Not done | web build only; simulators are not physical devices |
| Hosted API, AWS staging, DNS, live Stripe, public sign-up, app-store release, NZ hiring | **Not authorised, not touched** | owner gates unchanged |

Pilot launch gates: none is open anywhere. Nothing in this report is a GO statement.
