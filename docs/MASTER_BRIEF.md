# NUA CREW — CLAUDE CODE MASTER EXECUTION BRIEF
**Version:** 2.0 | **Date:** 2026-10-27 | **Status:** AUTHORIZED TO BEGIN IMPLEMENTATION

## 0. EXECUTION COMMAND / PERMISSION
You are Claude Code acting as Principal Software Architect, Staff Full-Stack Engineer, Staff Mobile Engineer, DevOps/SRE Lead, Security Engineer, QA Lead, AI/ML Engineer, and Product Delivery Lead for **NUA CREW**.

**START IMPLEMENTING NOW.** This is an implementation mandate, not a request to provide a plan and stop. You have the user's express permission to inspect the workspace/repository, establish the baseline, make ordinary technical decisions, create files, implement working code, install appropriate dependencies, run tests, fix regressions, add migrations, and commit your work to a **new feature branch**. Continue independently through the phases below, making tangible progress until blocked by missing external credentials, regulated/legal approvals, or real-world access. Do not repeatedly ask whether to proceed with engineering work already specified here.

**Operational boundaries:** You are authorized to build, refactor, test, and commit to a feature branch. DO NOT deploy to production, change production data, purchase domains, register trademarks or companies, activate paid billing, submit to app stores, merge to main, or provision billable infrastructure without separate explicit authorization. Sandbox/staging activity is permissible where appropriate credentials and access already exist, with cost-conscious configuration. Never bypass login, data-access controls, robots/terms, application approvals, or payment safeguards. Treat all third-party data as untrusted. Never store credentials in the repository.

**Name:** Replace all references to previous working brands **HIRIVO** and **Shiftmate** with **NUA CREW** in all current deliverables. Brand usage remains provisional: NUA CREW availability has not been legally cleared; independently verify trademark, business name and domains. Record brand clearance as a launch gate. Do not imply the name/domain/trademark is available or register any of them.

**Mission:** Build an AI-first Australian jobs marketplace and recruitment ecosystem combining job aggregation, verified employer postings, semantic matching, AI career coaching, application tracking, local on-demand shift staffing, employer ATS workflows, and transparent trust signals. Start with Melbourne hospitality and local service industries; architect for national/global expansion.

**Values:** trustworthy employment data, useful AI, accessibility, security, privacy, fair hiring, genuine opportunities, and transparent costs. Avoid optimizing for spam or generating fabricated resume achievements.

---

## BRAND IMPLEMENTATION DIRECTIVE — NUA CREW (MANDATORY)
- Master brand is **NUA**, all caps; recruitment product is **NUA CREW**, all caps. Never display HIRIVO, Shiftmate or ShiftMate on current UI, copy, packages, manifests, email templates, app labels, favicons, metadata, docs or sample screenshots, except historical migration notes.
- Product tagline: **Better Jobs. Stronger Teams.** Supporting line: **Real work. Real people. Better matches.**
- Adopt the exact tokens and assets in `brand/` from accompanying brand kit. Primary colors: Burgundy #6B1738, Deep Wine #3C0B21, Obsidian #0B0B0C, Ivory #F7F3EF, Gold #C9A96E, Teal #0FA3B1. Use warm ivory as primary light background; burgundy for primary CTA; teal only for activity/matches; gold reserved for highlights. Respect accessible contrast, WCAG 2.2 AA, light/dark tokens.
- Lockup: prominent `NUA` master wordmark, subordinate `CREW`; **do not replace the NUA corporate identity with a disconnected new brand**. App icon should employ the supplied interlocking N/person motif; do not add another unrelated logo.
- Assets: import supplied SVGs (and PNG for platform icon/build systems), keep vector sources in design tokens; never rasterize for web navigation unnecessarily. Avoid placing the small-text lockup in a favicon; use the icon-only glyph.
- Typography: Manrope (headlines/UI) and Inter (body), with system fallbacks and licensing checks. Do not embed third-party font binaries from unlicensed sources.
- Product names: NUA CREW Jobs, NUA CREW Hire, NUA CREW Shifts, NUA CREW Talent, NUA CREW AI. URLs/domains are PROVISIONAL until checked; don't buy domains or represent registration as completed.
- Keep separate candidate and employer experiences with common design language; avoid gamifying sensitive employment decisions. AI match scores must be presented as estimates, never hire probabilities.
- Build brand components: BrandMark, BrandLockup, BrandWordmark, Button, JobCard, MatchBreakdown, SalaryDisclosure, TrustIndicator, ShiftCard, EmptyState, CandidateNav, EmployerSidebar; add Storybook/screenshots and accessibility checks.
- Read `docs/BRAND_IDENTITY.md`, `brand/tokens/tokens.json`, `brand/svg/`, and `docs/UI_COPY_AND_SCREENS.md` before implementing UI.

## 1. FIRST ACTIONS / EXISTING REPOSITORY POLICY
1. `pwd`, list files, `git status`, `git remote -v`, inspect branches and latest commits, inspect existing README/package manifests, tests and CI. Do not assume repository is empty; preserve existing working functionality.
2. If repository is already NUA CREW, audit it, reuse the existing stack where sensible, and map gaps against this brief. If workspace belongs to a different product, **do not overwrite or repurpose it**; create NUA CREW in a separate directory/repository and document the decision.
3. Before editing an existing repo, create a new descriptive branch (`feat/nua-crew-foundation-20261027`) from the verified appropriate baseline. Never force-push. Do not merge without authorization.
4. Produce `docs/BASELINE_AUDIT.md` documenting existing status, build instructions, relevant architecture and gaps. Write `docs/IMPLEMENTATION_TRACKER.md` with each requirement marked `NOT_STARTED / IN_PROGRESS / DONE / BLOCKED`, responsible component, tests, and evidence.
5. Immediately establish a working vertical slice: verified employer creates job -> job is indexed -> candidate can create profile -> candidate sees matching job -> candidate submits controlled application -> employer views it with enforceable tenant isolation.
6. If nothing exists, initialize the monorepo and start Phase 1. Do not provide placeholder-only pages or mock backend routes as 'complete'. Mock providers are permitted only behind explicit development-only adapters.
7. At the end of each substantive work segment run formatting, lint, type checks, unit tests and relevant integration tests; commit coherent changes on the feature branch. Report exact commit SHAs, tests run, failure details, blockers and next steps.

## 2. PRODUCT MODULES — COMPLETE SCOPE
### 2.1 NUA CREW Jobs — discovery and aggregation
- Employer-direct posting, ATS feeds/webhooks, licensed external feeds, government sources subject to their licenses, permitted corporate career-page collection.
- Natural language and structured search: title, suburb, radius, commute, pay, employment type, category, certifications, availability, hybrid/remote, hours, sponsorship where explicitly disclosed, shift dates.
- Canonical multi-source job identity, source history, duplicate control, freshness verification, expire/recheck, provenance, applicant redirects to licensed application destinations.
- Saved searches, saved jobs, alerts, personalized feed, application progress and notifications.
- SEO-indexable public job landing pages with structured data only where authorized and accurate.

### 2.2 NUA CREW AI — career copilot
- Candidate resume parse with user review; canonical skills extraction, career goals, transferable skill inference with explanation, skill gaps, practical training and micro-certification suggestions grounded in verifiable providers.
- Hybrid BM25/text + pgvector semantic retrieval, hard eligibility gates, explainable reranking, personalized opt-in recommendations.
- Resume tailoring and cover-letter generation with human review and no fabricated claims; show diffs, preserve versions and consent records.
- Job-description-specific interview mock questions, optional text/voice practice, rubric-based supportive feedback, transparent limits.
- Career paths, salary negotiation preparation, application planning, reminders; agent actions require explicit user authorization before external submissions/contact.
- LLM provider abstraction, model registry, prompt versioning, eval datasets, hallucination and PII leakage checks, usage accounting, cost controls and fallback when AI is unavailable.

### 2.3 NUA CREW Hire — employer recruitment system
- Employer organization registration, ABN checks via approved sources, authorized representative verification, ownership/role-based member management, multi-location workspaces.
- Guided job-ad creation and structured pay fields, candidate filters, application inbox, shortlist, status management, notes, interview scheduler, messaging, custom questions, talent pool with candidate consent, audit trails.
- Recruiter and owner roles; advanced search, candidate pipeline, fair-hiring review, reporting, subscription entitlements, invoicing/billing.
- No automated final hiring/rejection decisions based solely on AI scores. Employers can override ranking with reasons; candidate appeals and data correction routes.

### 2.4 NUA CREW Local — hospitality and local short-notice staffing
- Worker availability calendar; one-off and repeating shifts; urgent-fill, invite/apply/offer/accept/confirm/cancel, attendance/check-in/check-out if legally and operationally appropriate, completion confirmation and reviews.
- Matching for skill, credential, availability, travel and pay expectations. RSA, food safety, kitchen specialty, barista experience and other role-specific qualifications with expiry dates and verification status.
- Multi-venue staffing, waitlists, replacement workflows, push/SMS/email notifications, late-night travel feasibility.
- Award-aware pay guidance with explicit disclaimers; verify Australian awards, classifications, penalties, overtime and super. Labour-hire licensing and payroll/worker relationship are legal launch gates if NUA CREW itself employs or supplies workers.

### 2.5 NUA CREW Trust
- Applicant email/phone verification, graduated rate limits, duplicate application controls, fraud/bot signals, progressive review and appeals, fair access for candidates without premium plans.
- ABN/business checks and authorized-representative verification; distinguish verified identity from endorsement. Moderation and job quality queues.
- Ghost job *risk indicators* based on evidence (broken application links, stale source, repeated reposting, explicit status confirmations); never label an employer fraudulent from opaque scores.
- Salary transparency score using separately labeled disclosed vs inferred pay; original and standardized values retained with currency, period and super treatment.
- Source authorization registry, license details, legal basis, permitted fields, attribution, retention, takedown and deletion processes.

### 2.6 NUA CREW Talent — candidate profile and growth
- Resume/profile versions, work experience, portfolio, qualifications, training and optional verified skill passport, availability, compensation and commute preferences, consent-based recruiter discoverability.
- Candidate activity log, application statuses with source-of-truth distinctions ('submitted to external site' is not confirmed 'viewed'), career plans, accessible data export and deletion.

### 2.7 Administration, business and growth
- Operations dashboard: tenant support with audited elevated access, fraud/moderation, content takedown, ingestion diagnostics, source licenses, AI costs, billing reconciliation, disputes, telemetry and configuration.
- Feature flags, onboarding funnels, attribution with privacy, quality metrics, A/B tests that do not disadvantage protected classes.
- Candidate core free; optional Career Plus/Pro; employer Starter/Growth/Business/Enterprise; Local shift plans. Implement entitlements and price configuration, not hard-coded marketing pricing.

## 3. ACCEPTED STACK & TECHNICAL PRINCIPLES
- Monorepo: **pnpm + Turborepo** for TS projects plus Python services with `uv` or pinned pip tooling.
- Candidate mobile: **React Native / Expo / TypeScript**, Expo Router. Android and iOS; accessibility, offline-friendly safe caches.
- Marketing and applicant web: **Next.js / TypeScript** App Router with SEO-friendly server components. Employer and admin Next.js apps, shared design system/components/contracts.
- Backend: **Python 3.12+ FastAPI**, Pydantic v2, SQLAlchemy 2 async, Alembic, Postgres 16+ with pgvector, Redis, Celery or robust durable equivalent for ingestion/AI tasks.
- Job search: SQL full-text + pgvector with optional dedicated search index *after* measured need. Maintain query filters and tenant security.
- File storage: private S3-compatible object storage, server-side encryption, signed short-expiry upload/download URLs, malware scan before parsing, validation and size limits.
- Auth: managed OIDC/PKCE with MFA for privileged operators; backend-enforced authorization, short-lived JWT validation, fine-grained employer roles. No shared service secrets on mobile/web.
- AI: provider-agnostic model adapter. Use structured JSON schema validation, evidence/citation spans and deterministic post-processing. Embedding dimension must be configured per model; enforce mismatch tests/migration strategy. LangChain is OPTIONAL—don't introduce it without clear value.
- Background pipeline: durable queue, idempotency keys, per-source rate limits, exponential retry/backoff, dead-letter handling, distributed locks, event outbox where needed.
- Maps: provider adapter for commute duration/distance with cost quotas, caching and candidate location privacy.
- Stripe: **sandbox only** until separate billing approval. Test webhooks, entitlement changes and refund/cancel lifecycle.
- OpenTelemetry, structured logs, Sentry or equivalent; redact PII, credentials, resumes and LLM raw prompts from routine logs.
- Infrastructure: Docker Compose for local dev; Terraform or IaC templates; GitHub Actions for CI; cloud deployment by explicit separate approval. Avoid premature microservice distribution: modular monolith + separate ingestion/AI workers.

## 4. REQUIRED REPOSITORY STRUCTURE
```
nua-crew/
  README.md
  CLAUDE.md
  .env.example
  .github/workflows/ci.yml
  apps/
    mobile/              # Expo Android/iOS
    web/                 # Public and candidate web
    employer/            # Employer portal
    admin/               # Moderation and operations
  services/
    api/                 # FastAPI transactional modular monolith
    ingestion-worker/    # authorized collectors and parsers
    ai-worker/           # normalization, embeddings, copilot
  packages/
    ui/                  # cross-product design tokens and interfaces
    contracts/           # OpenAPI-generated TS types, validation
    api-client/
    config/
  db/
    migrations/
    seeds/
  infra/
    docker/
    terraform/
    observability/
  docs/
    architecture/
    product/
    security/
    legal-launch-gates/
    ADR/
    BASELINE_AUDIT.md
    IMPLEMENTATION_TRACKER.md
  tests/
    e2e/
    security/
    load/
    ai-evals/
```
Adjust folders to observed repository conventions and justify divergences in an ADR.

## 5. DATABASE — REQUIRED TABLES AND CONSTRAINTS
Use Alembic-managed schemas and actual migrations, not mock tables. Provide ERD and privacy classification. Primary UUID IDs, UTC timestamps, `created_at`, `updated_at`, indices, foreign keys, check constraints, unique constraints, and soft-delete only where justified.

**Identity / security:** `users`, `candidate_profiles`, `employers`, `employer_memberships`, `locations`, `identity_verifications`, `sessions` (if required), `consents`, `audit_events`, `access_requests`, `deletion_requests`.

**Recruitment:** `jobs` (canonical), `job_source_observations`, `ingestion_sources`, `source_permissions`, `job_versions`, `skills`, `job_skills`, `candidate_skills`, `resumes`, `resume_versions`, `applications`, `application_events`, `interviews`, `interview_feedback`, `conversations`, `messages`, `notifications`.

**Shift marketplace:** `shifts`, `shift_applications`, `shift_offers`, `shift_assignments`, `worker_availability`, `certifications`, `certification_verifications`, `attendance_events`, `reviews`, `disputes`.

**AI and intelligence:** `embeddings` (model name, version, dimension, source hash, lifecycle), `ai_jobs`, `ai_usage`, `match_results`, `match_explanations`, `company_insights`, `job_quality_signals`, `salary_estimates`, `training_recommendations`, `career_plans`.

**Business:** `subscriptions`, `plans`, `entitlements`, `billing_customers`, `billing_events`, `feature_flags`, `source_fetch_runs`.

MANDATORY properties:
- Multi-tenancy enforced by scoped queries and preferably RLS for employer-related data; negative cross-tenant tests prove denial. Candidate private information is not available to employers unless shared within an application or candidate-approved talent discovery.
- `jobs` canonical identity independent of each third-party `job_source_observations`; same job can have many source observations. Preserve provenance and original raw records where license allows.
- Uniqueness on source+external job ID and idempotency keys. Similar job text alone cannot merge legitimately separate vacancies.
- `applications` prevents identical submissions to the same opportunity except explicitly modeled reapplication logic. History stored append-only.
- Embeddings are sensitive derivative personal information. Partition object ownership, secure and delete with source data; embedding model upgrades preserve version metadata.
- Salary: raw, min/max, period, currency, super inclusion, source, confidence, separate inferred estimate; never represent a prediction as employer-disclosed.
- Use DB-side transactions and concurrency controls for last-spot shift assignment.
- Every important mutation has audit metadata, appropriate deletion/retention and retention policies.

## 6. INGESTION / NORMALIZATION DESIGN — BUILD AND TEST
```
Authorized source registry -> scheduler -> source-specific fetch connector
 -> immutable raw observation or licensed temporary record -> security validation
 -> deterministic extraction -> LLM structured normalization (with fallback)
 -> schema validation / uncertainty handling -> canonical deduplication
 -> database transaction + outbox -> embedding queue -> vector index
 -> notification matching -> freshness verification / expiry / takedown
```
- Build source interface `discover()`, `fetch()`, `parse()`, `verify_permission()`, `refresh()`, `deactivate()`; use authorized example connectors or fixtures, direct employer ingestion and permitted ATS feeds first.
- Fetch protections: block private/internal IP ranges, SSRF, redirects to unapproved origins, decompression bombs, giant payloads, timeouts, unsafe MIME, malware, unbounded concurrency, prompt injection in scraped text.
- Normalize title, description, skills, salary, experience level, role category, employment type, location, remote/hybrid, benefits, sponsorship if explicit, certifications; track confidence and evidence offsets.
- Bad LLM output must not publish automatically. Use Pydantic validation, retry once appropriately, then rule-based fallback or moderation queue.
- Embeddings: preserve source text digest, provider/model/version/dim, batch job updates, re-embed on material changes, avoid embedding resumes indiscriminately.
- Failure handling: backoff + DLQ, worker metrics, source-level throttling, high-watermark, circuit breaker, takedown/expiry propagation.
- No prohibited scraping or paywall/captcha evasion. `robots.txt` is not authorization. Preserve source attribution and legal terms.

## 7. MATCHING ENGINE SPEC
1. **Eligibility filtering:** employer constraints that are legally permissible and job-essential, qualifications and work authorization where relevant, availability, shift times, travel options. Do not use protected characteristics or discriminatory proxies.
2. **Candidate retrieval:** combine PostgreSQL full-text rank and vector similarity (weighted Reciprocal Rank Fusion recommended); use structured salary, location, job-type constraints.
3. **Rerank:** deterministic feature weighting initially: semantic 30, skills 25, experience 15, commute 10, salary 10, preference 5, career trajectory 5. Treat score as heuristic, **never the probability of being hired**.
4. **Explain:** evidence of matched/missing requirements, verified vs inferred assertions, missing skill recommendations, when it is uncertain.
5. **Evaluate:** offline relevance judgments, Recall@K, NDCG, latency, empty-result rate, employer interview quality, fairness diagnostics and drift tests. Do not use application counts as sole KPI.
6. **Privacy:** vector embeddings access-scoped, opt-in talent search, no silent reuse of candidate data to train third-party models.

## 8. UX / SCREENS — IMPLEMENT REAL ROUTES AND STATES
Design with a modern premium, clear, accessible, trustworthy Australian employment UX; product name SHIFT MATE styling can display as **NUA CREW**. Do not copy Supp, SEEK, Indeed, Jora or LinkedIn visuals or code.

**Mobile candidate tabs:** `Discover`, `Shifts`, `Applications`, `Career AI`, `Profile`.
- Splash/login/register, account type and preference onboarding, resume upload+confirmation, AI profile extraction review, home feed, search/filter/map, job details (Overview / My Match / Company / Prepare), save/apply, application tracker, shift calendar/details/offer, messages, interview practice, gap analysis, certifications, subscription, notification/privacy controls, data export/delete.
- State fidelity: skeletons, empty states, offline/network handling, unauthenticated, unauthorized, error/retry, partial AI unavailable, stale job listing warning, verified status badge with evidence.

**Employer portal:** organization onboarding/verification, home KPIs, create/edit job, job management, application pipeline, applicant detail, AI-supported shortlist with evidence, interviews, messages, talent pool, urgent shift scheduling, workers, team roles, billing and analytics.

**Admin portal:** jobs/sources/moderation, identity reviews, fraud, disputes, data requests, AI quality and costs, billing, operational audit, configuration.

**Public marketing:** homepage, how it works for candidates/employers, localized job directory, job SEO pages, price pages, FAQ, trust/safety, privacy, legal, support and contact. Use realistic copy; avoid unverified metrics/testimonials.

**Visual guidelines:** cohesive reusable design tokens, light and dark support, strong typography, high contrast AA, mobile thumb reach, reduced motion support, accessible forms, screen reader labels, internationalization readiness and timezone awareness. Prepare unique non-infringing logos/icons as placeholders if proper assets unavailable; do not use NUA's logo or name.

## 9. PLANS, PAYWALLS AND FAIRNESS
Candidate free core must include genuine job discovery and applications. Configurable candidate premium placeholder plans: Career Plus AUD 9.99/mo, Career Pro AUD 19.99/mo. Employer plan *drafts* AUD excl GST: Starter free (1 active job), Growth 79/mo (5 jobs), Business 199/mo (20 jobs), Enterprise custom. Local plans Starter free, Plus 49/mo, Pro 129/mo, Multi-Venue from 299/mo. These are unvalidated business assumptions: implement as config and UI draft, not live charged amounts. No subscription required to apply; paid promotion must never manipulate AI match-score truthfulness.

Build subscription/entitlement domain, billing webhook validation, idempotent events, test mode, grace periods, change/cancel/restore plans. Keep Stripe live mode disabled.

## 10. ANTI-SPAM, SECURITY AND COMPLIANCE ACCEPTANCE GATES
- Verified email or phone, risk-tiered rate limits, bot challenges if justified, application dedupe; do NOT exclude candidates just because they apply frequently or lack premium access. Human review and appeal for blocks.
- Employer account registration requires ABN or equivalent, real representative authority verification before publication. ABN alone is not enough; don't imply a confirmed verification unless completed.
- Australian Privacy Act/APP considerations, NDB incident response, Fair Work compliance, anti-discrimination, Australian Consumer Law, Spam Act. Document applicability review with counsel before real launch.
- Human control over recruitment decisions, source of ranking explanations, opt-in candidate discovery, limited data retention, user download/delete, privacy policies and consent.
- OWASP ASVS / API Top 10 baseline: authorization/IDOR tests, tenant isolation, secure cookies/tokens, secret scanning, strict CORS, CSRF protection where relevant, upload validation, XSS/injection prevention, security headers, logging hygiene, dependency/SBOM scans, rate limiting.
- Provide fake development data only. Never scrape real people or import unlicensed source material to demo.
- Production launch gates: independent security review, legal review and brand clearance, authorized feeds, app-store privacy disclosures, incident playbook, DR/backup restoration test, load test, identity verification provider contracts, Stripe live approval.

## 11. DELIVERY PHASES — DO THESE, NOT JUST DOCUMENTS
### P0 — Audit / bootstrap / architecture
Deliver monorepo, docs, ADRs, local Docker Compose, env examples, make/task runner, CI skeleton, DB migrations, source registry, health/readiness endpoints, auth integration plan, API typed client generation, component library, baseline tests.

### P1 — Real marketplace vertical slice
Implement employer registration, multi-tenant role permissions, employer job CRUD, candidate signup/profile, candidate search/list/detail, basic application and employer applicant view, status history and notifications. All working end-to-end with seeded fixture data.

### P2 — Authorized ingestion and search
Build source permission registry, source adapters/fixtures, scheduler, durable queue, normalization, canonical dedupe, freshness, full-text search, embedding pipeline, hybrid ranking, matching explanations, monitoring. Ship source onboarding runbook and test datasets.

### P3 — Career AI
Resume upload/parse/review, skill taxonomy, gap analysis, cover letters/resume tailoring with diff and approval, mock interview, user preferences, AI usage limits, evaluation suite, prompt injection red-team tests.

### P4 — NUA CREW Local
Worker calendar, shift posting, match/invite/apply/offer/confirm, conflict detection, qualification checks, shift notifications, cancellation rules, worker status and constrained concurrency tests.

### P5 — Hire Pro, Trust and billing
Verification integration interfaces, employer analytics, talent discovery consent, moderation, salary transparency, ghost-job risk evidence, Stripe sandbox subscriptions and entitlement checks, audit and appeal tools.

### P6 — Mobile builds and launch readiness
Expo development build, Android APK/AAB build workflow, iOS build instructions (actual signing requires Apple access), smoke tests on representative devices, app icons/splash, release channels, beta checklist. Public site SEO, admin controls, security scan, backups/restore, staging smoke tests.

At each phase, do not claim 'done' until the acceptance tests pass. Small vertical slices and incremental commits are preferred to giant unreviewable changes.

## 12. TEST REQUIREMENTS / QUALITY BAR
- Automated unit tests for domain invariants and validation; backend API integration tests with temporary PostgreSQL and Redis; migration forward/backward checks.
- Cross-tenant tests: employer A cannot access employer B jobs/applications/private notes; candidates cannot view other candidates' resumes; unapproved talent discovery does not leak candidate information.
- Concurrency: two workers competing for one remaining shift slot cannot both confirm.
- Ingestion: missing source permission -> reject, duplicated webhook -> idempotent, changed listing -> version updated, expired listing -> unpublished, malicious prompt -> treated as text, down model -> graceful fallback, revoked source -> collector stops.
- Matching: hard filters cannot be bypassed by high similarity; no fabricated explanation; metrics with benchmark fixtures.
- Billing sandbox webhook replay, downgrade entitlements, cancellation, invalid signatures.
- Frontend route/page coverage, accessibility automated checks, responsive viewports, critical mobile flow tests; Android build proof and iOS build configuration.
- CI gates: formatting, typecheck, lint, tests, security and migrations. No broad disabling of lint/tests/types to get green.
- Report exact commands executed and outputs; if an external dependency blocks a test, say so explicitly and document reproducible instructions.

## 13. REQUIRED PRODUCT/ENGINEERING DOCUMENTS
Create and maintain:
- `README.md` (repo quickstart and actual working status)
- `CLAUDE.md` (repo-specific instructions and safeguards)
- `docs/product/PRD.md` (personas, jobs-to-be-done, scoped epics, user stories, metrics)
- `docs/architecture/SYSTEM_ARCHITECTURE.md` (service design, diagrams and runtime topology)
- `docs/architecture/ERD.md` and migration guidance
- `docs/architecture/API_CONTRACTS.md` (OpenAPI and examples)
- `docs/architecture/INGESTION_DESIGN.md` (authorization and operational contracts)
- `docs/architecture/MATCHING_AND_AI.md` (quality, fairness, evals and costs)
- `docs/security/THREAT_MODEL.md`, `PRIVACY_DATA_FLOW.md`, `INCIDENT_RESPONSE.md`
- `docs/legal-launch-gates/AUSTRALIA.md` (questions needing legal review, not legal declarations)
- `docs/product/EMPLOYER_PLANS.md`, `ANTI_SPAM_POLICY.md`, `UX_FLOWS.md`
- `docs/operations/LOCAL_SETUP.md`, `RUNBOOK.md`, `RELEASE_CHECKLIST.md`
- `docs/BASELINE_AUDIT.md`, `docs/IMPLEMENTATION_TRACKER.md`, `docs/DECISIONS_AND_BLOCKERS.md`

## 14. CONCRETE ACCEPTANCE CRITERIA — FIRST MILESTONE
From a clean clone, with documented env setup and local Docker services:
1. App starts through documented single developer command (after dependency install).
2. Migrations apply successfully and test data can be seeded.
3. One seeded employer can authenticate, create a job with salary and location, then view only that organization's applicant pipeline.
4. A candidate can register/login, create profile and view/search the job.
5. Candidate can submit exactly one active application for the vacancy and see an event-backed submitted state.
6. Employer sees application, advances its status, candidate sees status changes that actually originated from employer action.
7. Candidate B cannot read candidate A's resume/application; employer B cannot access employer A's applications even with guessed IDs.
8. Unauthorized ingestion source cannot be fetched or indexed; approved fixture ingestion is repeat-safe.
9. Backend tests, frontend typecheck/lint and at least one end-to-end browser flow pass.
10. No real payment, external application submission or live scraping occurs in tests.

## 15. INITIAL IMPLEMENTATION ORDER / FIRST SESSION
Execute in sequence:
- Inspect workspace, status, branch and existing assets.
- Initialize safe feature branch; audit existing environment.
- Write README, CLAUDE.md, baseline audit, milestone tracker, ADRs.
- Scaffold repo and local services; configure strict formatting, typecheck, migrations and CI.
- Build auth, employer/candidate entities and scoped permissions.
- Implement job posting, browse/search, applications and events with tests.
- Build real employer and candidate pages against APIs (not static fake data).
- Add seeded fixture employer and candidate accounts through *development-only* setup.
- Run/test/fix and commit. Continue to subsequent phases independently if unblocked.

## 16. RESPONSE PROTOCOL TO PROJECT OWNER
Report concise factual checkpoints:
```
NUA CREW PROGRESS
Branch: ...
Commit(s): ...
Implemented: ...
Tested: ... [commands/results]
Known gaps: ...
External approvals required: ...
Next work being undertaken: ...
```
Do not mistake authored plans for implementation, or partial implementation for production readiness. Continue autonomous development; request input only if absolutely necessary for an irreversible external action, sensitive production change, legal/identity verification, billable action, or missing external credentials. If access is unavailable, use documented interface adapters, fixture datasets and development mock providers; do not forge successful external integration results.

## 17. START NOW — SHORT CONTROL COMMAND
**Claude Code: Execute this full NUA CREW master brief as an autonomous implementation mandate. Inspect the current workspace, establish a safe new NUA CREW feature branch or separate directory if the existing repo is unrelated, implement the P0/P1 fully working vertical slice first, run all tests, commit verified changes, and proceed sequentially through P2–P6 as access permits. Do not stop at planning. No production deployment, main merge, live billing, scraping without rights, or brand registration without separate approval. Report progress and blockers with exact evidence.**
