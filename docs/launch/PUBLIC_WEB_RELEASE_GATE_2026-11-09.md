# Public web release gate: Australia, 9 November 2026

Directive: `docs/launch/CLAUDE_CODE_PUBLIC_LAUNCH_GO_GO_2026-11-09.md` (#79), issue #80.
Scope: public **web** registration, verified job posting and applications for Australia. Native
apps, Stripe, paid promotion, document upload and New Zealand stay off and are not gates here.

**Decision at this commit: NO-GO.** Evidence below is as of `main` `dcb1dea` plus the open
PR #83 named in the table. A READY Vercel build is not evidence of a working service.

This file is the checklist. It is updated only with evidence a reader can open: a PR, a commit,
a CI run, a deployment, a log. Anything not yet evidenced says so.

## Status key
**Code done** = merged to `main`, CI green, tested locally against a real Postgres. **Open PR** =
written and tested, not merged. **Owner** = needs an account, a purchase, a legal decision or a
dashboard action that cannot be done from the repository. **Not started** = nothing exists yet.
**None of these mean verified on the hosted stack.**

## 0. Infrastructure and secrets
| # | Gate | Status | Evidence / what is missing |
| --- | --- | --- | --- |
| 0.1 | API config for Vercel (explicit `uv` install, `syd1`, lean bundle) | Code done | #71 `6717122`. Production deployments of `nua-crew-api` build READY from `main`. |
| 0.2 | API starts and `/readyz` answers against a real database | **Not started, Owner** | The API project has **no environment variables**. It cannot start: the startup guard refuses without a database. Needs a Sydney Neon database (a purchase) and the variables in 0.5. |
| 0.3 | Runtime role cannot bypass RLS | Code done locally | Startup guard refuses superuser, BYPASSRLS, and any role that owns or can alter the schema: #73 `1dd4219`. Exercised against a fresh local cluster: runtime role starts, migrator and owner are refused. **Not yet run on Neon.** |
| 0.4 | Provider-compatible role bootstrap | Code done, **unverified on Neon** | `db/roles/neon_bootstrap.sql` and `docs/operations/NEON_ROLE_BOOTSTRAP.md`: #78 `7fd7bb4`. Rehearsed on a local non-superuser owner. First Neon run must be on a throwaway branch. |
| 0.5 | Secrets set as sensitive variables, migration credential kept off the function | Owner | `NUA_ENV`, `NUA_DATABASE_URL` (runtime role), `NUA_JWT_SECRET`, `NUA_CORS_ORIGINS`, plus 1.x and 0.7 below. `NUA_MIGRATION_DATABASE_URL` only in a protected one-off migration run. |
| 0.6 | Backups on, and a restore rehearsed to a disposable database | Owner | Not done. |
| 0.7 | Shared Redis; sensitive writes fail closed without it | Code done | #82 `dcb1dea` (fail closed on registration, reset, verification, apply, job create; API refuses to start outside development without `NUA_REDIS_URL`). **The Redis itself is an Owner purchase.** |
| 0.8 | Candidate and employer web apps deployed from current `main`, public production origins, no Vercel SSO on those origins | **Not done, Owner** | `nua-crew-candidate` last production deployment is `c5236975` (pre-launch); its newest deployment is a preview at `ffcfd55`. Neither web project rebuilds on merges to `main` (only `nua-crew-site` and `nua-crew-api` do). Why is not visible from here: check the Git link and any ignored-build setting. No production domains are attached to these two projects. Previews stay protected. |
| 0.9 | Server-side bypass header for protected previews only | Code done | #70 `0690f14`. Nothing is sent unless `API_PROTECTION_BYPASS` is set. Never used by the mobile apps. |
| 0.10 | Bot friction, WAF, security headers, alerting | **Not started** | Security headers exist in the API. No CAPTCHA/Turnstile (needs a provider choice), no WAF rules, no uptime or error alerting, no spend alerts. |

## 1. Email
| # | Gate | Status | Evidence / what is missing |
| --- | --- | --- | --- |
| 1.1 | Provider-backed sender behind the existing interface | Code done | #81 `845970e` (Resend adapter; request, error and log behaviour tested with a mock transport). |
| 1.2 | Provider account, verified sending domain (SPF/DKIM/DMARC), tracking off | Owner | Not done. The provider choice is the owner's. |
| 1.3 | **Real delivery to a real inbox**: verification and password reset | **Not evidenced** | Cannot be shown without 1.2 and a deployed API. A hard NO-GO item. |
| 1.4 | Verified-email gate stays on | Code done | Posting and applying require a verified email whenever mail can be delivered (owner decision, #56). It is inert while the provider is `none`, which is why 1.3 matters. |
| 1.5 | Bounce and complaint handling | Not started | The provider dashboard is the monitor until built. |

## 2. Candidate path
| # | Gate | Status | Evidence / what is missing |
| --- | --- | --- | --- |
| 2.1 | Register, sign in, verify email, reset password, sign out | Code done, local only | #66, #67 (real Postgres, real HTTP codes). Not hosted. |
| 2.2 | Browse **published** AU jobs, apply with a text note, see receipt and status | Code done, local only | #66. Document upload stays disabled. |
| 2.3 | Discovery opt-in OFF by default; consent audited | Code done | Negative test in #67. |
| 2.4 | Privacy and terms linked on the form | Code done | `/terms`, `/privacy` linked from the candidate form. **Content needs owner or counsel review (4.1).** |

## 3. Employer path
| # | Gate | Status | Evidence / what is missing |
| --- | --- | --- | --- |
| 3.1 | Register with a checksum-valid ABN (format only, never verification) | Code done, local only | #66, #67. |
| 3.2 | Operator verifies the business with evidence, reviewer and timestamp | Code done, local only | Admin verification in #66. **A named human operator with an SLA is an Owner item.** |
| 3.3 | Role, current award and pay check; under-award rate cannot publish | Code done, local only | Hard block in the API (ADR-011). Award data is `supplied_unverified` until an admin verifies it. **Verified current award rates are an Owner/operator item.** |
| 3.4 | Publishing is closed unless the owner opens the introductory offer; 14-day, capped, audited, no card | Open PR | #83. `NUA_INTRO_OFFER_ENABLED` defaults false; terms version `unapproved-draft`; caps are my proposals. |
| 3.5 | Cross-tenant access refused (API and RLS) | Code done, local only | Negative tests in #67 and #83. |
| 3.6 | Report and takedown path for published jobs | **Not evidenced** | A moderation router exists; a public job report/takedown path has not been verified for this launch. |
| 3.7 | Employer-app wording for the introductory offer and planned (not chargeable) A$49 pricing | Not started | #83 provides the endpoint; no UI yet. Pricing pages still describe A$49 and A$30 as planned. |

## 4. Legal and commercial (Owner only)
| # | Gate | Status |
| --- | --- | --- |
| 4.1 | Privacy policy, terms and employer terms reviewed; operator entity and ABN correct | Owner |
| 4.2 | Introductory offer wording, 14 days and fair-use caps approved | Owner |
| 4.3 | Email sender and marketing/service message separation confirmed | Owner |
| 4.4 | Database plan and cost accepted; spend alerts set | Owner |
| 4.5 | Support contact and moderation owner named | Owner |

## 5. Hosted acceptance (nothing here can be run yet)
Blocked by 0.2, 0.8 and 1.3. When unblocked, run the directive's sequence on **staging first**,
then on production with separate test identities, and record host, SHA, HTTP status, DB role,
region and sanitised request IDs:
1. Guest: marketing CTA to candidate sign-up and employer sign-up; hostile `next` values rejected.
2. Candidate: email delivered, confirm, sign in, browse, apply, status, password reset.
3. Employer: register, verify email, draft, "verification required", operator verifies, role and
   pay check, publish under the offer, permalink, applicants, edit, close.
4. Negatives on the hosted stack: registration closed before the switch, token replay, wrong
   role, cross-business access, under-award pay, unverified email, duplicate submit, Redis
   outage, database outage, mail outage.
5. Operability: cold start, concurrent instances, limits, restore rehearsal, rollback rehearsal.
6. Screenshots at 320, 390, 768 and 1440 px; axe checks; Android browser and iPhone Safari.

## Flags: opened last, together, only on GO
API (Vercel, production): `NUA_CANDIDATE_REGISTRATION=open`, `NUA_EMPLOYER_REGISTRATION=open`,
`NUA_INTRO_OFFER_ENABLED=true` (with the approved `NUA_INTRO_OFFER_TERMS_VERSION`).
Marketing site: `NUA_CANDIDATE_SIGNUP_OPEN=true`, `NUA_EMPLOYER_SIGNUP_OPEN=true`,
`NUA_JOB_POSTING_OPEN=true`, with `NUA_APP_URL` and `NUA_HIRE_URL` set to the verified hosts.
Do not set `NUA_PRODUCT_LIVE`. Each is an independent kill switch.

## Rollback order (fastest first)
1. API: `NUA_EMPLOYER_REGISTRATION=closed` and `NUA_CANDIDATE_REGISTRATION=closed`.
2. API: `NUA_INTRO_OFFER_ENABLED=false` (publishing closed; existing ads run to their end date).
3. Marketing: the three site flags to `false`.
4. Vercel: promote the previous READY deployment of each project (they are rollback candidates).
Existing accounts and data are untouched by any of these. **A rollback rehearsal has not been
done.**

## Current blockers, in order
1. A Sydney Neon database, the API variables and a first protected migration (0.2, 0.4, 0.5).
2. A shared Redis (0.7).
3. An email provider, verified domain and one real delivered message (1.2, 1.3).
4. Candidate and employer web apps deployed from `main` to public origins (0.8).
5. Legal, offer and cost approvals (section 4).
6. Operator capacity for business verification and award-rate data (3.2, 3.3).
7. Hosted acceptance, restore and rollback rehearsals (section 5, 0.6).
