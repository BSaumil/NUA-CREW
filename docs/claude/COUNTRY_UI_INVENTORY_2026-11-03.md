# NUA CREW — Country UI inventory, implementation and test evidence

**Date:** 3 November 2026 · **Owner B (cross-platform UX / QA)** · **Branch:** `feat/au-nz-cross-platform-ux-20261103`
**Status:** UI foundation only. New Zealand is **preview-only**. No NZ employment, pay, payment or application capability is enabled, and nothing here depends on an endpoint that does not exist.

Backend-owned files (`services/api/**`, generated contracts, `docs/IMPLEMENTATION_TRACKER.md`) were **not** edited.

## 1. What changed

| Piece | Path | Notes |
| --- | --- | --- |
| Market registry (C2) | `packages/markets/**` | AU `en-AU`/AUD/+61/ABN/state codes/seven AU zones, existing flow. NZ `en-NZ`/NZD/+64/NZBN/16 region labels (no codes)/`Pacific/Auckland`,`Pacific/Chatham`, `preparing`. Unknown code → `blocked`. States: `supported-for-display \| preparing \| blocked \| supported-for-transactions`. No env/local flag can enable a transaction; only the legacy AU flow or a validated server response can. Search market, workplace jurisdiction and employer entity are separate types. Money is integer minor units; mixed currencies are never summed or compared. 34 unit tests. |
| Shared UI (C3) | `packages/ui/src/market.tsx`, `onboarding.tsx`, `trust.tsx`, `cards.tsx` | `MarketProvider`, `MarketRadios`, `MarketLocationFields`, `MarketPreviewNotice`, `GatedSubmit`; `GuidedSetup` disables the final submit with a reason; `SalaryDisclosure`/`JobCard` take `locale`, `showCurrencyCode`, `currency`, and show a country badge **only** for `verifiedCountry`. |
| Employer web (C3) | `apps/employer/app/register`, `job-form.tsx`, `jobs/new`, `actions.ts`, `lib/market.ts` | Country choice; AU fields keep their names (`abn`, `suburb`, `state`, `postcode`). NZ fields use `nz_preview_*` names. Server actions refuse any non-allowed/missing country **before** calling the API. |
| Candidate web (C4) | `apps/web/app/jobs/page.tsx`, `lib/search-markets.ts` | "Search in" checkboxes (`?markets=AU&markets=NZ`), URL-only, nothing stored. NZ selected → not-enabled notice; NZ-only → API not called. Mixed selection → ISO-coded pay and a "never added together" note. |
| Mobile Android/iOS (C4) | `apps/mobile/src/features/markets.ts`, `src/ui/market.tsx`, `app/(auth)/register-employer.tsx`, `app/(app)/discover.tsx` | Radio/checkbox chips with accessible roles and `checked` state; in-memory search markets (no AsyncStorage); NZ preview gate; AU state lists come from the registry. |

## 2. Route / screen matrix

"Functional" = backed by the real API in the screenshots. Nothing below is a mock.

| Flow | Web path | Mobile screen | Country-aware now? | AU assumptions that remain (and why) |
| --- | --- | --- | --- | --- |
| Employer registration | `apps/employer/app/register/page.tsx`, `actions.ts` | `app/(auth)/register-employer.tsx` | **Yes** (choice + NZ preview gate + server guard) | `/v1/auth/register/employer` accepts AU only (ABN, AU `state` enum, 4-digit postcode). Backend-owned. |
| Business verification / venues | `apps/employer/app/admin`, `team` | `app/hire/business.tsx` | Partly (state codes from registry) | Venue modal still AU: 4-digit postcode, AU `state` enum in `LocationOut`. |
| Job posting | `apps/employer/app/jobs/new` + `job-form.tsx` | `app/hire-post.tsx` | **Web yes** (country choice, NZ preview gate, server guard); mobile no | "Pay (AUD)", super options, `/v1/employers/{id}/jobs` has no country field. Mobile post flow not gated yet. |
| Guided pay check / award | `apps/employer/app/jobs/new/guided` | `src/ui/pay-check-panel.tsx` | No | Fair Work awards and `location.state` are AU-only by design (ADR-011); NZ must come from backend rule providers. |
| Shifts | — | `app/hire-shifts.tsx` | No | `Australia/Melbourne` display zone, AUD labels; shift records carry no venue IANA zone. |
| Applicant review | `apps/employer/app/jobs/[id]` | `app/hire-applicant` | n/a | No country data shown. |
| Talent / invitations | `apps/employer/app/talent`, `invitation` | `app/hire/talent.tsx`, `invitation/[id].tsx` | No | `window_time_zone: 'Australia/Melbourne'`, AU city zone chips, `pay_currency: 'AUD'`. |
| Billing | `apps/employer/app/billing` | — | No (unchanged) | A$19/30/49 planned prices, AUD formatting. **Payments and NZ pricing stay OFF**; no NZD price is inferred. |
| Candidate register / profile | `apps/web/app/profile` | `app/(app)/profile.tsx` | Partly (mobile state codes from registry) | AU state list, 4-digit postcode, "Minimum hourly pay (AUD)". Profile API has no country. |
| Job search | `apps/web/app/jobs/page.tsx` | `app/(app)/discover.tsx`, `app/filters.tsx` | **Yes** (search markets) | Min-pay filter chips are `$` / hourly-AU (38-hour week conversion); filters sheet not yet market-aware. |
| Applications / messaging | `apps/web/app/applications` | `app/(app)/applications.tsx`, `inbox.tsx` | n/a | NZ applications are not enabled: no NZ listing can be opened. |
| Availability / shift records | — | `app/availability.tsx`, `my-shifts.tsx`, `src/features/availability.ts` | No | AU zone list and `Australia/Melbourne` formatting. |
| Format helpers | `packages/ui/src/{trust,cards,pay}.tsx`, `apps/mobile/src/features/format.ts` | same | Partly | `en-AU` defaults remain for legacy records; `showCurrencyCode` / `locale` available. |
| Marketing site | `apps/site` | — | Not touched | `/markets` already says AU/NZ are pre-launch. |

## 3. Safety design (three layers for NZ)

1. **Client gate:** the final submit is disabled with the reason (`GatedSubmit`, `GuidedSetup`, mobile `Button disabled`).
2. **Server-action guard:** `marketRefusal()` rejects missing/unknown/preview countries before any API call; the form carries the country field.
3. **API unchanged:** an AU-only endpoint never receives an NZ payload, and ABN/AUD are never forced onto NZ.

Records have no verified country in the current contracts, so no country badge is shown and no record is offered as an NZ result.

## 4. Test evidence — what ran vs what is blocked

| # | Required test | Result | How |
| --- | --- | --- | --- |
| 1 | AU regression (AUD, state/territory, AU field names) | **Ran, pass** | `packages/ui/test/market.test.tsx`; Playwright `country-ui.spec.ts`, `onboarding.spec.ts` (employer & candidate registration unchanged) |
| 2 | NZ preview: NZD, NZ regions, submit disabled | **Ran, pass** | ui unit, Playwright, mobile jest (`markets.test.tsx`), screenshots |
| 3 | Unknown market fails closed | **Ran, pass** | `packages/markets` (34), ui unit (`ZZ`), mobile jest, `?markets=ZZ` e2e |
| 4 | Mixed-country pay labelled with ISO code, not summed | **Ran, pass** | ui unit; markets `sumMoney` refuses mixed currency. No real mixed-country records exist (API has none). |
| 5 | Tenant / role isolation unchanged | **Ran (regression only)** | No authz code touched; existing Playwright/API suites cover it. New employer routes were not added, so no new cross-tenant test was needed. Not independently re-run in full here — see CI. |
| 6 | Mobile small Android / iPhone / tablet / large text | **Partly ran** | Expo web export in Chromium at 360 px, 390 px, 820 px: no horizontal overflow, accessible roles verified in jest. **Blocked:** real Android/iOS devices or simulators, OS large-text scaling and keyboard avoidance (no emulator in this environment). `expo export` Android + iOS bundle compile **passes**. |
| 7 | No registration / indexing / store links / Stripe / live-NZ promise | **Ran, pass (by inspection + e2e)** | No site or billing change; NZ copy says "being prepared… does not save, publish, book or charge". |
| — | `axe` accessibility (light + dark) of employer register & job search | **Ran, pass** | `accessibility.spec.ts` (14 pages) + ui unit axe in AU and NZ states |

Other gates run locally: `pnpm --filter` typecheck + lint for `ui`, `web`, `employer`, `mobile`; `markets` tests; `ui` tests (48); mobile jest (252); `next build` for web and employer; mobile `bundle:check`.

**Blocked / not done (needs backend or devices):** real client bindings to `MarketPublicInfo`/capabilities (no endpoint yet); NZ region codes; verified per-record country; venue IANA zones for shifts; mobile job-post and shift country gates; mobile filters sheet; OS-level dark mode / large-text device checks.

## 5. Screenshots (genuine, from running apps)

Captured from production builds of `apps/web` and `apps/employer` and the Expo web export, against the real local API/Postgres.

- `screenshots/employer-register-au-desktop.png` — AU unchanged (ABN, State, Postcode)
- `screenshots/employer-register-nz-preview-desktop.png` — NZ: NZBN, Region, NZD notice
- `screenshots/employer-register-nz-final-disabled-phone.png` — NZ final step, submit disabled with reason
- `screenshots/employer-job-new-nz-preview-desktop.png` — job entry, NZ preview
- `screenshots/web-jobs-au-nz-phone.png` — candidate search, AU+NZ, NZ notice, `AUD` labels
- `screenshots/web-jobs-nz-only-desktop.png` — NZ only: nothing listed
- `screenshots/mobile-register-nz-final-phone.png` — mobile NZ preview, create disabled
- `screenshots/mobile-discover-au-nz-phone.png`, `mobile-discover-au-nz-tablet.png`, `mobile-discover-nz-only-phone.png`

## 6. Risks and follow-ups

- Do not merge or deploy until Owner A's API contract exists; then add real bindings in a follow-on PR through small adapters with explicit `notAvailable` states.
- `MarketLocationFields` reorders AU fields slightly (ABN now after location name); names and labels are unchanged.
- Legacy records are displayed as AUD only because the API defines them so; this must be replaced by a per-record currency once supplied.
