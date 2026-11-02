# NUA CREW — Country-aware API foundation
**3 November 2026** · Implementation phase P1 · **PR review/staging required before live API migration**

This change introduces an extensible jurisdiction boundary while leaving New Zealand hiring and billing disabled. It does not activate recruitment services, payment collection, Search indexing, or app-store distribution.

## Implemented
- Nullable `country_code` on employers, jobs, shifts and pay assessments. Existing `locations.country` remains authoritative for workplace location.
- Evidence-only AU data backfill. ABN identifies Australian legal-entity evidence; job derives AU only from a linked AU workplace with a valid AU state, four-digit postcode and AUD currency. Unknown data remains NULL and cannot be published without reconciliation.
- AU/AUD and NZ/NZD defined separately in a backend market adapter. Unknown countries, NZ publishing/shift creation/billing, and mismatched currency fail closed. NZ pay assessments explicitly return not assessed; Australian awards must never be reused.
- Pydantic schemas, OpenAPI/TypeScript contract and mobile UI propagate jurisdiction. Existing AU employer venue form submits country explicitly; NZD pay displays with `NZ$` rather than an ambiguous dollar sign.
- Existing RLS, tenancy membership, candidate privacy, pay-check and append-only audit invariants remain unchanged. No new private tables or insecure endpoint is added.
- Regression tests for country/currency mismatch, location derivation, migration backfill and mobile display.

## Release order and guardrails
1. Review legal, immigration, employment and tax implications separately for AU and NZ; both market activation switches remain OFF.
2. Before applying Alembic `c55d06af1005` to a shared or production database: take a verified backup, check data provenance and test upgrade/downgrade + RLS against staging.
3. Deploy the migration before shipping API code that references the new columns; run smoke tests for existing AU jobs, adverts, shifts and pay assessments.
4. Monitor and reconcile records where country remains NULL. Never mass-default to AU based on browser locale, IP or server timezone.
5. Enable NZ onboarding only after NZBN verification, NZ regional geography, verified employment-rate and holiday providers, rights-to-work handling, privacy and tax review, and country-specific checkout are validated.
6. The marketing Vercel deployment is **not** an API migration or permission to activate payments.

## Ten recommended improvements after this foundation
1. Verified and effective-dated NZ wage, leave, public-holiday and agreement assessment provider, with human override audit.
2. ABN/NZBN business identity verification and beneficial-employer ownership controls.
3. Worker multi-country search with explicit country/eligibility consent and currency labels.
4. Market-aware temporary shifts, regional holidays, rest breaks and timesheet dispute workflow.
5. Separate AUD/NZD payment catalogues with GST and receipt compliance.
6. Role/qualification equivalency matrix (RSA, food safety, barista, culinary), expiry reminders.
7. Privacy-first right-to-work verification vault with strict access and retention.
8. Employer multi-venue and multi-market management with scoped permissions and country analytics.
9. Fraud and ghost-job risk reporting with transparent action and appeals.
10. A market launch console: per-country capabilities, reviews, monitoring, approval history and rollback.

## Next implementation
Backfill verification and business country approval; NZ pay adapter with legal sources, effective dates and not-assessed gating; then web/Android/iOS country forms and testing. Keep NZ payments, job posting and live registrations off until all country-specific gates pass.
