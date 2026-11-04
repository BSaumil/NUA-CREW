# Australian award data governance (4 November 2026)

Summary of how award data is governed. Sources of truth: `docs/ADR/011-hospitality-taxonomy-and-award-engine.md` and `docs/operations/AWARD_DATA_RUNBOOK.md`.

## Principles
- **No invented wage figures.** Rates and multipliers are data, stored `supplied_unverified` until an admin compares them with the official Fair Work pay guide and marks them `verified`.
- **Roles are a search taxonomy, not an award classification.** The employer confirms coverage and classification; the engine only assesses.
- **Four honest outcomes:** `compliant_as_assessed` (only for the checks listed as assessed), `below_minimum`, `requires_review`, `missing_source`.
- **Exact money:** integer cents and basis points, one half-up rounding step.
- **Versioned and auditable:** `award_rate_versions` and `penalty_rule_versions` carry `effective_from/to`, source URL and note, and `data_status`. Loading and verifying are admin-only and audited. Overlapping versions are refused.
- **Server-side gate:** a job with a role cannot publish without a current pay check; below minimum is a hard block; a stale check must be redone.
- **Isolation:** pay assessments are visible only to the issuing employer.

## Not implemented (reported to every employer as "not assessed")
Allowances, evening/night loadings, overtime, minimum engagement, leave loading, junior/apprentice/trainee schedules, enterprise agreements, and any public holiday dates not loaded. Registered Clubs weekend and holiday multipliers have no supplied source.

## Update procedure (each 1 July and on any award change)
1. An admin loads new rate versions and penalty rules with source URL and note (runbook endpoints).
2. A person compares each against the official pay guide, then verifies it with a note.
3. Regression tests and the stale-rate warning are checked before relying on the new data.

## Open items
Whether the production database holds any `verified` rates is **not known to Claude**; it was not inspected. Stale-rate alerting and an admin approval workflow beyond verify/load are not built. NZ must never reuse any of this (`NZ_READINESS_GATES.md`).
