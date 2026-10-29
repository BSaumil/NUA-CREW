# Hospitality roles and award engine — final report (2026-10-29)

- Branch: `feat/hospitality-roles-awards-20261029` (stacked on `feat/claude-release-acceptance-20261029`, PR #6)
- Baseline SHA: `e732f8a`. Final SHA and PR link: see the pull request (not merged, not deployed).

## What was built

- **Taxonomy**: 287 roles (HC-0001…HC-0287), 14 departments, tiers 1–8, 261 aliases, imported idempotently from the supplied workbook (sha256 recorded). A title is a search label, never an award classification.
- **Award engine**: Restaurant MA000119, Hospitality MA000009, Fast Food MA000003, Registered Clubs MA000058; date-versioned rates, casual loading, weekend/public-holiday multipliers where stated, 12% super shown as a separate employer cost. Integer cents/basis points, half-up rounding, DST-safe shift splitting at local midnight.
- **Publish gate**: roles with a `role_code` cannot publish without a current pay check; below minimum is a hard 422; review-needed requires acknowledgement; shift creation re-checks the day rate. Assessments are immutable and tenant-isolated (RLS).
- **Employer UX**: guided posting (web) and native hire flow (shared app) with venue, role search, award pay check, roster.
- **Candidate UX**: multiple roles with experience (web `/profile/roles`, mobile `my-roles`), role-fit in match explanations, role/department search filters.
- Worked pay examples and scenarios: `HOSPITALITY_IMPORT_RECONCILIATION_2026-10-29.md`. Design: ADR-011 and `docs/product/HOSPITALITY_ROLES_AND_PAY.md`.

## Tests run (this session, this tree)

| Check | Result |
| ----- | ------ |
| API `ruff check`, `ruff format --check`, `mypy app` | clean |
| API `pytest` | 276 passed |
| Mobile jest | 228 passed (34 suites) |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | clean |
| Playwright e2e (incl. axe light/dark, tenant isolation, direct-API publish block) | full run 39 passed, 1 failed (my own new two-role removal step); fixed and the hospitality-mobile spec re-run: 3/3 passed. The full suite was not re-run end to end after that fix. |

A bug found by the e2e logs: the web role "Remove" button's `name` was overridden by React, so it posted the wrong role code. Fixed by binding the code to the action; the e2e now checks that removing one role leaves the others.

## Screenshots (real, from the e2e runs)

`docs/reports/screenshots/hospitality-2026-10-29/`: employer-1…5, mobile-1…6, web-1 (12 images).

## Not verified / limits

- **All rates and penalty rules are `supplied_unverified`.** Nothing was checked against Fair Work; an admin must verify before relying on them. Wage classifications are never inferred from a title.
- Not loaded: Clubs weekend/PH multipliers, evening/night, overtime, allowances, junior/apprentice/trainee, enterprise agreements, public-holiday calendars. These are reported as "not assessed".
- Jobs without a role are not award-checked (legacy ads). Making role mandatory needs reconciliation of existing ads.
- Role relationships, qualifications and certificates are deferred (not in the supplied data).
- Android/iOS: tested only as the shared app's web build and jest; no device testing.
- **Deployment: none.** No hosted API/DB exists; the marketing site is the only deployed part and is unchanged by this work.

## Next steps (priority)

1. Admin verification of rate versions against the Fair Work pay guide.
2. Load Clubs weekend/PH rules and public-holiday calendars once sourced.
3. Device testing on iOS and Android.
4. Decide whether role becomes mandatory for hospitality ads.
5. Import ChatGPT's updated positions/pay-grade list when delivered.
