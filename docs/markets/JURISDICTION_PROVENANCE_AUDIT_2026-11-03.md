# NUA CREW — Legacy Jurisdiction Provenance Audit (Read-only)
**Date:** 3 November 2026 · **Purpose:** Identify risky legacy assumptions before creating AU/NZ schema migrations.

## Observed model facts

- `locations.country` exists but has a server-side `AU` default. Some records therefore may be tagged AU **without a verified physical workplace or legal-entity jurisdiction**.
- `jobs.pay_currency` exists but defaults to `AUD`. This might reflect a default, not verified national-currency evidence.
- `candidate_profiles.state`, `jobs.state` and API `State` currently use Australian terminology; NZ region onboarding must not be plugged into those shapes directly.
- `employers.abn` currently supports an Australian ABN only. NZBN needs a **separate, correctly reviewed** identifier flow, not a renamed ABN input.
- `shifts.hourly_rate_minor` is an integer with **no explicit currency on the shift row**. A future shift must inherit a reviewed workplace jurisdiction and currency from its verified parent job; ambiguous shifts must not be considered NZ-pay-valid.
- `pay_assessments.input`/`result` are immutable snapshots. A future ruleset must record effective date and country; do not rewrite historical assessments.
- The baseline migration revision and all subsequent changes must be read from the actual Alembic tree. Do not assume any particular file is HEAD.

## Safe SQL inspection — counts only, NOT a migration

Use an **authorised, read-only, audited database role** with explicit permission to view aggregate cross-tenant information. A tenant-limited RLS role is not proof of a full-system audit. These queries do not contain personal records or change rows. Do not attach the output to public issues if it could reveal confidential business metrics.

```sql
-- Country and currency defaults/disagreements: aggregate only
SELECT COALESCE(l.country, 'UNKNOWN') AS workplace_code,
       COALESCE(j.pay_currency, 'UNKNOWN') AS job_currency,
       j.origin,
       count(*) AS job_count
FROM jobs j
LEFT JOIN locations l ON l.id = j.location_id
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Direct jobs with missing venue, venue owned by another employer, or currency conflict
SELECT
  count(*) FILTER (WHERE j.origin = 'direct' AND j.location_id IS NULL)
    AS direct_jobs_without_location,
  count(*) FILTER (
    WHERE j.location_id IS NOT NULL AND l.employer_id IS DISTINCT FROM j.employer_id
  ) AS location_employer_mismatch,
  count(*) FILTER (
    WHERE l.country = 'AU' AND j.pay_currency <> 'AUD'
       OR l.country = 'NZ' AND j.pay_currency <> 'NZD'
  ) AS known_currency_country_conflict
FROM jobs j
LEFT JOIN locations l ON l.id = j.location_id;

-- Existing shifts inherit job jurisdiction; count weak links
SELECT count(*) AS shifts_total,
       count(*) FILTER (WHERE j.id IS NULL OR l.id IS NULL) AS shifts_without_venue_country,
       count(*) FILTER (WHERE j.employer_id IS DISTINCT FROM s.employer_id)
          AS shifts_with_employer_mismatch
FROM shifts s
LEFT JOIN jobs j ON j.id = s.job_id
LEFT JOIN locations l ON l.id = j.location_id;
```

`review_legacy_job()` is an advisory-only **pure function** to classify evidence consistency. Even `CONSISTENT_UNVERIFIED` always requires manual validation; it can never authorise a database migration by itself.

## Migration phases

1. Prove single Alembic HEAD from current checkout, compare model metadata to schema and inspect all recent migrations.
2. Add nullable country fields to missing tables with **no backfill default** and reversible, additive DDL. Preserve existing `locations.country` but do not trust its legacy default.
3. Review provenance of each employer and physical workplace, and record documented evidence. Only after review, populate a verified country and effective date.
4. Validate job ↔ workplace ↔ employer tenancy and currency; block NZ publishing if unresolved or mismatched. Shift currency must be explicit or derived from verified job rules in a transactionally safe manner.
5. Write negative security tests across tenants/countries and late-dated award data; do not enable NZ paths until reviewed providers are in place.
6. Extend Pydantic schemas, OpenAPI, generated clients and mobile UX in lockstep, without removing old AU defaults unexpectedly.
7. Validate migration upgrade/downgrade against representative anonymised snapshots (including ambiguous, orphaned and mixed-currency rows).
8. Release behind capability gates and keep a rollback protocol; **no production data mutation before audit and explicit migration approval**.

## Safety

No Australian awards may be reused as NZ legal wage rules. No automatic NZBN issuance, Stripe NZ pricing, candidate transfer or work-right decision. The current website remains pre-launch.
