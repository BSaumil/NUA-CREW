# Country registry and jurisdictions — as built (4 November 2026)

Describes what is on `main` (`f10a55e`), not a plan. Details of the API contract: `docs/markets/API_COUNTRY_CONTRACT_V1_2026-11-03.md`.

## Three separate concepts (never merged)
1. **Candidate search market**: where a person chooses to look. A UI intent only: held in the URL (web) or in memory (mobile), never stored, never used for pay or law.
2. **Workplace jurisdiction**: where the work happens; decides which employment rules apply. Comes only from an explicit choice or a verified record, never from IP, device location, phone prefix or a flag.
3. **Employer legal entity country**: where the business is registered.

## Where each layer lives
| Layer | Path | Role |
| --- | --- | --- |
| Frontend registry | `packages/markets` | Display/form config per ISO-2 code (locale, currency, phone prefix, region labels, postcode, IANA zones, business identifier). `getMarket` returns `null` for unknown input. States: `supported-for-display`, `preparing`, `blocked`, `supported-for-transactions`. Only the legacy AU flow or a validated server response can reach `supported-for-transactions`. No local flag can enable a transaction |
| Frontend gates | `packages/ui/src/market.tsx`, `onboarding.tsx`; employer `lib/market.ts`; mobile `src/features/markets.ts` | Disabled submit with a reason; the server action refuses any non-allowed country **before** calling the API |
| Backend registry | `services/api/app/markets.py` | Typed AU/NZ market with `employment_ruleset`, capabilities (`onboarding`, `job_publishing`, `shifts`, `billing`) all off for new transactions |
| Read-only API | `GET /v1/markets`, `/v1/markets/{code}` | Informational catalogue; unknown country 404; write methods 405. **Not an authorisation source** |
| Gates | `services/api/app/services/jurisdictions.py` | `require_market_capability`, `require_job_currency`, `verified_workplace_country` |
| Storage | Alembic `c55d06a11005` | Nullable `country_code` on employers, jobs, shifts, pay assessments; `ruleset_code` on pay assessments; ISO checks; index on `jobs.country_code`. **No backfill** |

## Rules that hold
- Unknown or missing country fails closed for regulated actions. There is no default country.
- `locations.country` has a historical `AU` default, so it is not evidence. A workplace counts as Australian only when its state and postcode also look Australian (`verified_workplace_country`). Older rows keep a NULL country.
- Pay currency must match the workplace's market. Amounts in different currencies are never summed or compared.
- Country is never a replacement for tenant authorisation: row-level security and membership checks still apply to every record.
- The Australian award engine rejects NZ employers and jobs.

## Adding a country
Add one entry to the frontend registry and one to the backend registry with every capability off, plus its own compliance adapter and its own release gate. No view should branch on "AU" or "NZ".

## Known limits
Region codes for NZ are not defined; legacy API requests accept Australia only; venue IANA zones are not yet carried on shift records (some screens still format in `Australia/Melbourne`).
