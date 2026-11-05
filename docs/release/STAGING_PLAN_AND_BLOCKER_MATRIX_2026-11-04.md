# Staged plan and blocker matrix — 4 November 2026

Records the decisions ChatGPT returned on the decision packet (posted as a comment on #32 under the owner's account), what Claude has verified, and what remains blocked. **No production migration, paid provisioning, DNS change, live Stripe, NZ activation or public launch is authorised by this document.**

## Decisions received
| Topic | Decision |
| --- | --- |
| Migration `c55d06a11005` | GO-WITH-CHANGES for an isolated **staging** database. **NO-GO for production.** Owner approval for production has not been given |
| Hosting | GO for configuration and staging **design**. NO-GO for paid provisioning, production deploy and DNS |
| Chosen shape (for design only) | Separate Vercel projects for marketing (`nua-crew-site`, existing), candidate web, employer web. AWS Sydney (`ap-southeast-2`): FastAPI and worker as always-on ECS Fargate tasks, RDS PostgreSQL 16 (pgvector) with separate runtime and migrator roles, private Redis, encrypted S3, isolated ClamAV, Secrets Manager, monitoring. Environment name `nua-crew-staging`. **Railway is out of scope** |
| Proposed hostnames (not live) | `crew.nuapos.com.au`, `jobs.crew.nuapos.com.au`, `hire.crew.nuapos.com.au`, `api.crew.nuapos.com.au`. `iksaa.com.au` unchanged |
| CORS | Exact HTTPS origins only, no wildcard |

## Migration chain on `main` and in open PRs
`b44c05ef1004` → `a44b95ef1004` (document vault) → `c55d06a11005` (country jurisdictions) → `d66e11cc1006` (pricing; **draft PR #33, not merged**; extends `ck_order_amount` to allow 7900; downgrade refuses while any A$79 order exists). A staging rehearsal must run the whole chain, including `d66e11cc1006` once #33 is merged or its branch is rehearsed.

## Open question for approval: how to make `c55d06a11005` safe on a large table
`ck_locations_country_iso` and the four `country_code` checks validate on creation, and `ix_jobs_country_code` is not built concurrently.
- **Option A, edit the revision in place** (`NOT VALID` then `VALIDATE CONSTRAINT`; concurrent index in an autocommit block). Acceptable only if no shared environment has applied it. Claude knows of none: it has run only on local and CI databases. Revision id stays the same, so #33's `down_revision` is unaffected.
- **Option B, leave it and add a follow-up revision** that validates constraints and builds the index concurrently. Safer if any shared environment might already have `c55d06a11005`; costs one more revision.
- Claude has **not** changed the migration. Decision needed: A or B, and confirmation that no shared database has applied it.

## Verified by Claude (evidence this session)
| Item | Result |
| --- | --- |
| Whole chain applies from an empty database; older dev database upgrades from `b44c05ef1004`; single head | Verified locally; also CI green on #28/#29 |
| `downgrade a44b95ef1004` then `upgrade head` | Verified locally |
| API suite | 361 passed locally (includes the new availability regression tests) |
| NZ and unknown countries fail closed in UI and API | Tests green |
| Availability defect behind the #32 API failure | Root-caused and fixed; see below |

## Defect review: #32 `api` failure (run 41841751974)
- **Symptoms:** `test_confirmed_commitments_conflict_but_applications_do_not_reserve` and `test_results_are_a_privacy_whitelist` failed.
- **Cause, as ChatGPT suspected:** `load_availability` and the talent search both ignored commitments that ended more than a day ago, while the tests used a hard-coded 3 November. After that date a busy window read as `available`, and an employer search for it listed the candidate.
- **Product decision taken:** employer talent search now refuses a window that has already ended (`422 window_in_past`); hiring is forward-looking. The candidate's availability check loads every commitment that overlaps the asked window (with its buffer), so an old window is answered from the commitment that covered it. The calendar overview still returns only upcoming and just-ended commitments.
- **Not weakened:** privacy assertions are unchanged.
- **Regression tests:** use a fixed historical date (2020-01-07) and a computed upcoming DST night, so they do not depend on the day they run; the three new ones fail on the old code. The DST-resolution case is also tested at schema level with a fixed 2026 date.
- **Verification required before merge:** full API and browser E2E on the exact PR SHA (CI).

## Staged plan (each stage needs its own approval to start)
| Stage | Content | Status |
| --- | --- | --- |
| 0 | Decisions, reports, migration approach, blocker matrix | This document |
| 1 | Dockerfiles for API and worker, health probes, secrets/env matrix, Terraform **plan only** (no apply), cost estimate and alerts, smoke and E2E scripts | **Not started** (design approved, files not yet written) |
| 2 | Staging environment `nua-crew-staging` provisioned by the owner; migration rehearsal on an empty database, backup and restore rehearsal | Blocked on stage 1 and owner provisioning |
| 3 | Browser journey and API suite against staging; document storage, scanner and push provider tested with real services | Blocked on stage 2 |
| 4 | Production migration, DNS and any public step | **Not authorised** |

## Blocker matrix
| Blocker | Type | Verified? | Needed to clear |
| --- | --- | --- | --- |
| Production approval for the migration | Owner | Confirmed: not given | Written approval after preflight results and rollback rule |
| Preflight query results from the real database | Access | No production access | Owner or ChatGPT runs the five read-only queries; add NULL counts, sizes and lock timings |
| Migration option A or B | Owner/ChatGPT | Open | Decision above |
| AWS account, billing, Terraform state, Secrets Manager | Owner | Not provisioned | Owner |
| Vercel projects for candidate and employer web | Owner | Not created | Owner |
| Domains and DNS | Owner | Not live | Owner approval |
| Private storage and ClamAV | Infrastructure | Not connected; uploads disabled | Stage 2–3 |
| Identity/recovery provider, push provider, monitored worker | Infrastructure | Not connected | Stage 2–3 |
| Backup and restore rehearsal | Operations | Not done | Stage 2 |
| Stripe test credentials and tax/GST position | Owner | Skipped for now | Later |
| Legal entity and ABN used in the footer | Owner | ChatGPT notes the ABN is publicly listed as active for NUA AUS; exact invoicing entity and GST still to confirm | Owner |
| Real Android/iOS device acceptance and signing | Devices/assets | Not available | Owner |
| NZ capabilities | Legal | Preview only | `docs/compliance/NZ_READINESS_GATES.md` |
