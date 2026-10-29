# NUA CREW — Claude Code Implementation Directive
## Australian Hospitality Role Taxonomy, Award Classification & Pay Compliance Engine
**Issued:** 29 October 2026  
**Target:** NUA Crew (existing web, Android and iOS products)  
**Priority:** High — foundational to employer hiring, employee profiles, casual shifts and wage transparency  
**Inputs (attach both files to Claude Code / place in the repository under an appropriate docs/imports directory):**

1. `NUA_Crew_Hospitality_Roles_Hierarchy_Paygrades_Australia_2026-27.pdf`
2. `NUA_Crew_Australian_Hospitality_Roles_Paygrades_2026-27.xlsx`

> **Execution authority:** Begin development, analysis, testing and improvement without seeking approval at every stage. Inspect the actual NUA Crew codebase first. Do not invent its stack, schema, existing capabilities, repository paths or deploy status. The historical NUA POS-specific branch/deployment prohibitions must not be incorrectly applied to the separate NUA Crew product. Follow the current repository protection rules and permissions. A production deploy or merge is permitted only if authorised in the current NUA Crew workflow and all required checks, backups and release gates pass. Never bypass checks or expose secrets.

---

## 1. Mission and success criteria

Build the most practical, trustworthy and intuitive Australian hospitality hiring taxonomy and award-aware pay system, embedded across **NUA Crew's employer website, employee experience, Android and iOS apps**. Support café, takeaway, bar, pub, bistro, fine dining, banquet, event, catering, hotel, resort, club, housekeeping, gaming and corporate multi-venue roles.

Do not merely upload or display a PDF. Convert the supplied data into **normalised, validated, searchable, versioned and maintainable application data and behaviour**. Both hiring and job-seeking journeys must be simpler than an unstructured job title or free-text salary input.

Deliverables:

- Single canonical hierarchical hospitality role catalogue (source workbook reportedly contains **287 roles across 14 departments**; verify against real source, identify duplicates and report exact import totals).
- An award classification and wage engine with legal-reference traceability, date-effective rate versions and meaningful uncertainty flags.
- Employer job creation with role search, suggested classification, salary/pay compliance prompts, skills and certificates.
- Employee profile, résumé parsing/mapping, shift preferences and compatible matching search by role and competencies.
- Complete, polished responsive web, Android and iOS UI, preserving existing NUA Crew brand identity, design system and application patterns.
- Automated tests, migrations, rollout/rollback strategy, source references, administrative update tooling and concise release evidence.

## 2. Initial repository audit — mandatory first action

1. Identify canonical NUA Crew repo, active branch, latest commit SHA, application architecture, API/backend, ORM/schema, database, authentication, permissions, web/mobile apps, design tokens, job listing flow, candidate flow, employer flow, existing wage logic, current role/categories taxonomy and CI/CD.
2. Identify ongoing Claude/other contributor changes. Avoid overwriting uncommitted work, unrelated refactors or regressions.
3. Check whether role catalogues, skills, certificates, wage tables, Fair Work integration, employer job forms, shift marketplace, Stripe employer billing, PDF/resume upload and matching already exist. **Extend rather than duplicate**.
4. Record baseline and create a descriptive feature branch if needed. Prepare a small gap audit and a dependency-ordered implementation plan inside repository docs.
5. Read both input files completely. The PDF is guidance; the Excel workbook is the preferred **structured import source**. Cross-check workbook coverage and report inconsistent or missing rows.

## 3. Canonical role taxonomy

Maintain distinct entities for:

- `department` — examples: Café & Casual Dining; Restaurants & Fine Dining; Bars/Pubs; Kitchen & Culinary; Pastry & Bakery; Banquets & Events; Hotel Front Office; Housekeeping; Catering; Clubs & Gaming; Stewarding; Administration/Finance/HR/Sales; Facilities/Security/Stores; Multi-Venue/Corporate.
- `occupation_role` — stable ID/slug, canonical title, plain-English description, department, hierarchy rank, default workstream (FOH, BOH, management, support), active status, skill category and optional seniority.
- `occupation_alias` — spelling variants and common synonyms such as waitstaff/waiter, kitchen hand/kitchen porter, commis, Chef de Partie/CDP, maître d', barback/glassy, F&B attendant; retain searchable original title.
- `role_relationship` — reports-to, peer/senior/subordinate or suggested career progression; avoid forcing a single hierarchy for every venue.
- `role_qualification` / `role_skill` — qualifications, competency tags, work rights flags and optional certificates (e.g., RSA where applicable; food safety requirements as jurisdiction/duty dependent, not universal).
- `venue_type` — café, takeaway, restaurant, fine dining, bar/pub, club, hotel/resort, banquet venue, catering etc.
- `role_venue_compatibility` — one role may be applicable to multiple venues.

Data rules: unique stable IDs, idempotent seed/import, no duplicate roles from aliases, migration rollback, separate display order vs seniority, searchable accent-insensitive terms, localisation-ready labels, role status and audit trail. Preserve 287 source records unless a documented reconciliation identifies true duplicates, with mapping of old to canonical IDs. Distinguish searchable positions from legally defined award classifications.

## 4. Australian industrial instrument / award data model

Build independent, versioned and explainable entities:

- `industrial_instrument` — Award, Enterprise Agreement, or Award-Free/Unknown; award code, title, source URL, version, effective dates, update status.
- `award_classification` — award-specific classification ID, grade/level, definition, required duties/training, occupation stream, adult/junior/apprentice/trainee applicability, progression rules.
- `award_rate_version` — effective_from/to, source reference, source retrieval/publication metadata, currency, base hourly/weekly/annual minimum and calculation flags.
- `penalty_rule_version` — weekday, evening/night, Saturday, Sunday, public holiday, overtime, casual loading, shiftworker, minimum engagement, broken shifts or other relevant penalty rules **as applicable to the particular award and classification**.
- `allowance_rule_version` — applicable allowances and conditions, not flat additions to every role.
- `classification_mapping` — occupation role + industrial instrument + evidence conditions => one or more possible classifications; store confidence, criteria and manual-review requirement.
- `pay_assessment` — employer inputs, suggested award/classification, effective date, base offer, ordinary-hours pattern, employment type, jurisdiction and venue coverage, rate breakdown, uncertainty notes, employer confirmation and timestamped audit.

**Important:** A **job title is never an authoritative award classification**. The correct industrial instrument is determined by actual employer business coverage, industrial instruments/agreements, location, employee duties, skills, training, age and employment conditions. A Head Chef, Sous Chef, Restaurant Manager, Bar Manager or executive role must not be assumed automatically to be Level 6 or award-free. Some specialised employees are covered by other occupational awards. Never claim the offered rate is fully compliant when the coverage facts are unresolved.

### Awards for initial coverage

- Restaurant Industry Award 2020 — **MA000119**.
- Hospitality Industry (General) Award 2020 — **MA000009**.
- Fast Food Industry Award 2020 — **MA000003**.
- Registered and Licensed Clubs Award 2020 — **MA000058**.

Also support an enterprise agreement or an award-free status after proper assessment. Expand only after confirming the award coverage and source data. Do not assume a reception centre or standalone bar is covered by an award from its venue label alone.

### Published reference rates / validation examples

The supplied workbook/PDF provide 2026–27 snapshot figures. **Reconfirm every numeric rule and effective date against current official Fair Work award PDFs/pay guides and applicable Fair Work Ombudsman material before treating it as production truth.** At 1 July 2026 the source files list Restaurant/Hospitality adult permanent ordinary hourly rates approximately: Introductory **$25.74**, Level 1 **$26.44**, Level 2 **$27.08**, Level 3 **$27.97**, Level 4 **$29.45**, Level 5 **$31.30**, Level 6 **$32.13**; casual ordinary hourly examples **$32.18 / $33.05 / $33.85 / $34.96 / $36.81 / $39.13 / $40.16**. The sources also identify separate Fast Food and Clubs rates. These are **reference fixture values, not a universal cross-award pay formula**. Reconcile the PDF, Excel and official pay guides and document variances before database seeding.

Implement Australian 12% superannuation guarantee and any applicable payday contribution/payment timing in the **employer cost estimate as a separate component** (not part of a base cash-wage comparison unless an instrument specifically provides otherwise). Track statutory changes as date-versioned rules. Ensure wage/super displays are correctly labelled gross, inclusive/exclusive, cash vs on-cost.

### Pay calculations and uncertainty

The engine must:

1. Find applicable industrial-instrument candidates; ask targeted questions to resolve ambiguous award coverage or route to human review.
2. Resolve employment type (full-time, part-time, casual, apprentice, trainee, junior) and duties-based classification; show the supporting definition and why it was suggested.
3. Check ordinary, Saturday, Sunday, public holiday, evening, overtime and allowance scenarios using authoritative award-specific rules. Handle junior and apprentice percentages and applicable conditions, not adult-rate substitutions.
4. Evaluate each specified roster/shift with local timezone and state/territory public holidays, cross-midnight boundaries, breaks, minimum engagements, overtime thresholds and prescribed loading interactions.
5. Show employer offered pay against minimum **for each relevant shift**, not just weekday base wages; compare salary arrangements with applicable entitlements via documented methodology and flag needs for annualised salary/offset review where relevant.
6. Clearly mark `compliant_as_assessed`, `below_minimum`, `requires_review`, `missing_source` or equivalent, with transparent evidence. **Hard-block an objectively below-minimum advertised wage** if authoritative inputs are complete. Allow a safe review path for unresolved award or enterprise agreement cases; never fabricate a compliant result.
7. Explain super, leave, taxes and employer on-costs separately; do not conflate employee take-home wage with employer total cost.
8. Support effective-dated historical records so jobs originally posted at an older rate remain auditable while active jobs can be rechecked when wage rates change.

## 5. Employer website and mobile job-ad flow

Create an exceptionally easy, accessible mobile-first hiring workflow with tasteful, consistent NUA Crew graphics and minimal cognitive load:

1. **Venue & industry:** confirm venue and employer's coverage situation.
2. **Role:** department -> searchable role combobox with aliases, suggested seniority, selected title and custom public-facing title when appropriate. Avoid giant drop-down menus with 287 entries.
3. **Requirements:** skills, optional experience, certificates, work rights, location, roster, weekly hours, employment type and availability.
4. **Pay:** show award/classification suggestions with explanation and confidence; offer employer-confirmed classification, base hourly/salary, weekend shifts, penalties, super, allowances and an estimated compliant rate range.
5. **Preview:** employee-facing pay disclosure, clear application CTA, precise expectations and mobile-optimised card preview.
6. **Publish:** server-side validation and audit trail, with legitimate override/review workflows for ambiguous awards rather than silent bypass.

Preserve existing pricing/billing arrangements (e.g., employer-paid job ads and promotional placement) and the existing Stripe integration; do **not** rewrite billing as a side effect. Do not create real charges or configure production credentials without explicit approval. Retain existing vacancy and applicant data.

## 6. Employee app and matching journeys

- Employee role preferences: searchable department/occupation selector, multiple roles, seniority, experience and desired pay; synonyms should map to canonical IDs.
- Candidate résumé import: extract candidate-provided role/skill terms as proposed mappings; always allow user review/correction. Preserve file permissions and privacy.
- Employer-applicant compatibility: score using role/skills/availability/location/certificates and declared pay fit; explain match factors. Do not make opaque or discriminatory eligibility inferences.
- Temporary shift matching: reflect shift timings, applicable penalty rules, clear estimated pay breakdown, minimum engagement, certifications, employer details and cancellation terms.
- Job discovery and filters: roles, venue, pay rate, employment type, location, required qualifications and availability; indexing/pagination for scale.
- UI consistency: shared taxonomy/search semantics and consistent labels and compliance hints across website, Android and iOS. Handle keyboard, touch targets, accessibility, dark mode, screen readers, loading/empty/error states and offline/network recovery consistent with existing architecture.

## 7. Security, privacy and reliability requirements

- Preserve multi-tenant business isolation and server-side authorization. No client-supplied `businessId` may grant cross-business access.
- Rate/classification administration restricted to privileged roles; publish change log/source; job poster cannot edit the statutory minimum table.
- No public access to candidate private documents/certificates; enforce signed upload/download URLs, malware/file-type validation, size limits and retention controls where applicable.
- Never place secrets in source control, logs or example data. Preserve PII privacy, consent, data deletion/export workflows and least privilege.
- No underpayment workaround through client-side-only checks. Enforce server-side validation for publish and shift booking.
- Ensure safe migration, index strategy, unique keys, transactions, auditability, observability and rollback.
- No unsupported scraping that violates site terms. Prefer official Fair Work guides and structured, reviewed administration over fragile external scraping.

## 8. QA and acceptance tests — required before claiming completion

Provide real evidence for:

1. Import count and taxonomy consistency: all source records reconciled, 14 departments verified, aliases, stable IDs, no duplicates, idempotent repeated import and rollback.
2. Correct award selection explanations: restaurant vs fast food vs hotel vs club; nontrivial mixed-venue and enterprise-agreement cases appropriately reviewed.
3. Known classification fixtures for waiter, bar attendant, Food and Beverage Supervisor, kitchen hand, Cook Grade 1–5, Chef de Partie, managers, apprentices/juniors where data are available.
4. Exact decimal-money calculations (avoid floating point), rounding, effective-date boundaries, penalty stacking, overtime, cross-midnight shifts and weekend/public holiday differences between awards.
5. Under-minimum wage blocked; unresolved classification flagged honestly; no fabricated minimum or universal 25%-casual-loading inference when award specifics differ.
6. Full employer workflow: register/login -> select venue -> create role -> set wages -> see compliance -> publish -> receive application -> assess applicant -> message/invite; verify existing functionality remains intact.
7. Employee workflow: profile -> multiple role preferences -> upload résumé -> search -> apply -> invitations/messages; Android and iOS screens in realistic small-screen sizes.
8. Shift marketplace: same-role available shifts, time conflicts, wage breakdown, bookings, cancellations and timesheets, if implemented already.
9. Tenant isolation (negative tests), role-based permissions, malicious uploads, input validation, race conditions and audit logging.
10. Responsive visual QA: Chrome desktop/tablet, Android, iPhone; screenshots and accessibility checks. Use project test infrastructure/available device emulators; **do not falsely claim hardware tested**.

Produce at least **five actual screenshots** from completed NUA Crew flows (employer role select, pay assessment, listing preview, employee role preference, mobile shift/job listing). If running emulator/browser is not possible, state what was not verified and provide reproducible capture steps instead of mock screenshots presented as tests.

## 9. Implementation phases and delivery evidence

**Phase 0 — Audit & source validation**  
Repo and source file inventory; official Fair Work reference links; change plan and risk list.

**Phase 1 — Taxonomy foundation**  
DB migrations, canonical roles/departments/aliases/skills, deterministic source imports, queries, API, seed validation.

**Phase 2 — Award rules engine**  
Versioned award coverage, classification definitions, pay rules/penalties/public holidays, employer-pay calculator and explainability, data administration.

**Phase 3 — UX and integrations**  
Role picker and wages for web/employer; employee mobile profiles/search; shared matching and temporary shift integration; strong NUA branding.

**Phase 4 — Quality and release**  
Unit/integration/E2E tests, security review, accessibility/mobile screenshots, data migration preview, controlled launch, rollback instructions and post-launch monitoring.

Work incrementally, committing coherent changes. Preserve existing NUA Crew business features, authentication, messaging, billing, uploads and mobile build paths. Open an appropriately scoped PR with clear before/after functionality. Merge/deploy only when repository protections and release authorisation are satisfied, all required CI/test checks pass, and a rollback path exists. If a step cannot be executed, **document the blocker and supply exact next commands** rather than claiming it completed.

## 10. Final response contract from Claude Code

Report with concrete, verifiable evidence:

- Repo, baseline SHA, working branch, final commit SHA and PR URL.
- What was already present, what changed and what is still pending.
- Source record counts; taxonomy table/field summary; awards implemented and source/effective dates.
- Concrete worked pay examples (including weekday, weekend, casual and public holiday comparisons with named award and shift assumptions).
- Web/Android/iOS feature status separately; verified test commands/results and screenshots.
- Security/privacy changes; migrations, backup and rollback instructions.
- Any uncertain/missing Fair Work data that is correctly flagged for review.
- Deployment status and live URLs **only if independently verified**.
- Prioritised next steps, separating production blockers from enhancements.

**Quality bar:** NUA Crew must be a beautiful, fast, low-friction hiring platform, but **accuracy, employee fairness, employer clarity, lawful wages, security and accessible UX outrank decorative complexity**.
