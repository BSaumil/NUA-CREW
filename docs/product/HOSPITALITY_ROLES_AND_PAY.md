# Hospitality roles and award-aware pay (employer and worker guide)

Source data: `docs/imports/hospitality/` (workbook, PDF, directive; sha256 in `docs/reports/HOSPITALITY_IMPORT_RECONCILIATION_2026-10-29.md`). Design record: ADR-011.

## What people see
- **Employer (web and the shared Android/iOS app):** venue → role (search, aliases, no 287-item dropdown) → pay check (award, classification, rate) → review → save → publish. The pay check shows the casual or permanent weekday minimum, the Saturday/Sunday/public-holiday minimums, super as a separate employer cost and a plain list of what it does not cover. Below the minimum cannot be saved or published. "Needs your review" needs a recorded acknowledgement.
- **Worker (web and app):** "Roles you do" (up to 8, one main role, years of experience, private to the person), role suggestions found in their own résumé (proposals only), the role on every ad, and a "role" line in the match explanation (self-declared; skipped when either side has no role).
- Search: `GET /v1/jobs?role=HC-0060` and `?department=restaurant-fine-dining-foh`; saved searches accept `role_code` and `department`.

## API
`GET /v1/taxonomy/{departments,venue-types,roles,roles/{code}}`, `GET /v1/awards`, `GET /v1/awards/coverage-guidance`, `POST/GET /v1/employers/{id}/pay-assessments[/{aid}[/acknowledge]]`, `GET/PUT /v1/candidate/roles`, `GET /v1/candidate/roles/suggestions`, admin `GET /v1/admin/awards/rate-versions`, `POST /v1/admin/awards/{rate-versions,penalty-rules}/{id}/verify`, `POST /v1/admin/awards/public-holidays`. Job create/update accept `role_code` and `pay_assessment_id`.

## Operating the data
- Re-import the committed seed (idempotent): `cd services/api && uv run python -m app.hospitality_import` (schema-owner connection).
- Rebuild the seed from the workbook: `uv run --with openpyxl python scripts/build_hospitality_seed.py <workbook>`; regenerate the reconciliation report: `PYTHONPATH=. uv run python scripts/hospitality_report.py`.
- **Verify rates** (admin only): `GET /v1/admin/awards/rate-versions`, check each against the Fair Work pay guide, then `POST …/verify` with a source note (audited). Until then every assessment says the reference rates await verification. A new financial-year rate is a new row with `effective_from`; set the old row's `effective_to`.
- **Public holidays:** load the official state calendar through the admin endpoint. Until a state's calendar is loaded, shifts there are treated as ordinary days and the engine says so.
- **Rollback:** `alembic downgrade a33b94de1003` drops the new tables and the two job columns (jobs keep everything else). Back up the database first; reference data is re-created by the next upgrade.

## Limits to keep in mind
Not assessed: evening/night, overtime, allowances, minimum engagement/breaks, leave loading, junior/apprentice/trainee, enterprise agreements, annualised salaries. Clubs weekend/holiday multipliers are not loaded. A pay check is not legal advice, and "meets the minimum as assessed" never means "compliant".
