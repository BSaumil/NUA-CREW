# NUA CREW — Read-only Market API Contract
**Date:** 3 November 2026 · **Owner:** ChatGPT backend workstream  
**Branch:** `feat/jurisdiction-backend-foundation-20261103`  
**Status (historical source):** Implemented in PR #26, integrated with PR #25 by merged PR #28 on 3 November 2026. Consume the actual regenerated OpenAPI/TypeScript contracts from the integrated `main` and validate against the release candidate. This document describes the read-only catalogue only; the integrated country storage and publication safety gates are documented separately.

## Endpoints

| Method | Route | Availability |
| --- | --- | --- |
| GET | `/v1/markets` | Public, read-only, no registration or JWT required |
| GET | `/v1/markets/{country_code}` | Public; case-insensitive configured country |
| POST/PUT/PATCH/DELETE | Both routes | Not supported (405); this API cannot enable a market |

Unknown country returns **404** with `{"detail":"Market is not configured"}`, never an AU fallback.

### Response shape for GET /v1/markets

The array includes currently configured AU and NZ entries, with more possible later. Do not require `array.length === 2`, sort by position, or hard-code every future market.

```json
[
  {
    "country_code": "AU",
    "label": "Australia",
    "locale": "en-AU",
    "currency": "AUD",
    "region_label": "State or territory",
    "employer_identifier_label": "ABN",
    "phone_prefix": "+61",
    "time_zones": ["Australia/Melbourne", "Australia/Sydney", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide", "Australia/Darwin", "Australia/Hobart"],
    "stage": "prelaunch",
    "capabilities": {
      "onboarding": false,
      "job_publishing": false,
      "shifts": false,
      "billing": false
    }
  },
  {
    "country_code": "NZ",
    "label": "New Zealand",
    "locale": "en-NZ",
    "currency": "NZD",
    "region_label": "Region",
    "employer_identifier_label": "NZBN",
    "phone_prefix": "+64",
    "time_zones": ["Pacific/Auckland", "Pacific/Chatham"],
    "stage": "preparing",
    "capabilities": {
      "onboarding": false,
      "job_publishing": false,
      "shifts": false,
      "billing": false
    }
  }
]
```

OpenAPI type: `MarketPublicOut` composed with `MarketCapabilitiesOut`. **Import types from generated OpenAPI**, not this Markdown, after the PR is merged.

## Contract rules for Claude Code

- Use the endpoint to **render** country selectors and disabled states. It has no authority to grant employment, payments, posting or identity verification.
- Existing AU route endpoints continue unchanged; this new catalogue must **not** be used to break or bypass current Australian route permissions.
- `stage` is informational. Only a *future authenticated server-side write endpoint* with explicit country validation, tenant authorisation, effective-dated labour rules and individual approvals may allow a transaction.
- Employer legal-entity country, workplace location country and candidate search preferences are separate values. This endpoint does not return stored country data for any particular business/job.
- The original `locations.country='AU'` database default is not proof that legacy records were jurisdiction-verified. Unknown or ambiguous records must not be silently converted to NZ or marked as verified.
- Never infer country from IP, phone prefix or the employee's device locale.
- Display money with the ISO currency. No cross-currency arithmetic or AU award rate lookup for NZ.
- Never allow clients to POST/PUT to this catalogue; do not introduce a frontend-only capability override.

## Test evidence expected

CI runs `test_markets.py`, `test_markets_api.py`, `test_jurisdiction_audit.py`, plus existing API RLS tests. Verify /openapi.json and no regression in AU registration/job flows. Confirm `GET /v1/markets/ZZ` returns 404. DO NOT claim CI passed until it has actually passed.

## Integrated migration status (updated 4 November 2026)

PR #28 integrated the additive jurisdiction migration `c55d06a11005` and PR #29 re-parented it after document-vault revision `a44b95ef1004`, retaining one intended Alembic head. The columns were added **without a blanket legacy backfill**. An existing `Location.country='AU'` default is not sufficient proof of verified country provenance. Before any migration in a new environment, inspect the *current release SHA*, actual Alembic head, migration SQL, RLS policies, backups, and verified workplace evidence. No production migration or AU/NZ activation is authorised by this documentation. See [provenance audit](JURISDICTION_PROVENANCE_AUDIT_2026-11-03.md) and [launch stabilisation directive](../launch/LAUNCH_STABILISATION_EXECUTION_2026-11-04.md).
