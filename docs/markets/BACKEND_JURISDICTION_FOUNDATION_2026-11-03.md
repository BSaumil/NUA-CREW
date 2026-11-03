# Next implementation — jurisdiction-aware backend foundation

**Date:** 3 November 2026  
**Branch:** `feat/jurisdiction-backend-foundation-20261103`  
**Scope:** Safe backend registry and regression tests; no live NZ transactions.

## Implemented in this PR

- `services/api/app/markets.py`: country keyed backend registry with AU and NZ's own ISO currency, locale, employer identity labels and named employment rulesets.
- Unknown/missing workplace jurisdiction fails closed rather than defaulting to Australia.
- Distinct capabilities for onboarding, publishing, shifts and billing; **all default disabled** in this standalone registry. The existing AU route-specific feature flags and permissions are NOT replaced by this registry.
- Explicit currency validation rejects using AUD on a NZ job or NZD on an AU job; no automatic conversions.
- Monetary input representation rejects negative, infinite and NaN values. **No wage compliance conclusion is implied**.
- `services/api/tests/test_markets.py`: positive tests, invalid jurisdiction, cross-currency and disabled-capability tests.

## Next backend PR (separate, migration-gated)

Do not create or run database migration until identifying the **actual current Alembic HEAD**, reviewing all migrations and mapping existing rows. This avoids migration forks or retroactively mislabelling legacy data.

1. Add nullable jurisdiction fields to employers, jobs and any shift/pay assessment tables that lack them, retaining existing `locations.country` with explicit validation.
2. Backfill country **only from verified source** (e.g. a valid country-tagged location). Leave ambiguous rows unresolved and prevent their republication until reviewed.
3. Preserve AU data and tenant RLS, verify location/employer/job country agreement, and index justified filters.
4. Introduce an authoritative country-specific rule-provider interface; NZ must have independent wage/legal assessment. Missing instruments/sources => `not_assessed` and publishing blocked.
5. Extend OpenAPI schemas, generated TS clients, web, Android and iOS *together*, with regression tests. Do not silently default to AUD or assume AU employment law for NZ.
6. Keep registration, live payments, indexing and publication gates off until owner, counsel and tax approvals.

## Country expansion follow-on

New country ISO code -> explicit Market config -> country verification -> effective-dated labour and holiday rule-provider -> local privacy and tax review -> public feature flags -> controlled pilot. Unknown codes never grant access.

**Review rule:** This PR alone does not launch country selection in forms and does not change production job publishing behavior. Its registry must be integrated under a separate, fully tested PR before it becomes authoritative for any live endpoint.
