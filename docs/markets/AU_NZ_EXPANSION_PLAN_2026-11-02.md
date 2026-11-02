# NUA CREW — Australia, New Zealand and Future Markets
**Plan date:** 2 November 2026 · **Owner direction:** Australia + New Zealand as target markets, expandable to further countries.  
**Implementation branch:** `feat/au-nz-multi-market-foundation-20261102`.  
**Status:** Marketing/configuration foundation is implemented; live recruitment services in either country are **not** activated by this document.

## 1. Launch principles

- Australia and New Zealand are distinct **employment jurisdictions**, not translations of one pay table.
- Market launch is four separate gates: marketing visibility, account onboarding, job publishing/shift matching, and paid advertising. None implies the next.
- Existing Australian employers, profiles, wage records and jobs retain their historical Australian meaning. Avoid silently changing records or defaulting NZ jobs to AU.
- Never infer a country from IP address to alter legal entitlements, tax, billing or visibility. Require a verified venue/job location and an explicit jurisdiction selection.
- Business/candidate isolation, consent, immigration/work authorisation, private files, audit trails, and human decisions remain non-negotiable.
- Employees are free under the current commercial direction. Australian employer pricing is only a **preview**. NZ dollar pricing and tax treatment are **not set**.
- Public website is pre-launch and stays `noindex` until separate owner approval. Marketing copy is accurate about launch status.

## 2. Implemented in the website

- `apps/site/lib/markets.ts`: ISO-3166-1 alpha-2 keyed, extensible `MarketConfig` registry (AU/NZ) with country, locale, currency, phone prefix, example time zones, administrative region terminology, employer identifier, employment ruleset and independent capabilities.
- All market write capabilities default to **false**, including job publishing and paid checkout. Unknown market lookup fails closed.
- `/markets`: a real website route showing both countries and their current preparation status without falsely offering accounts.
- Main navigation, footer, homepage copy, sitemap, route-specific SEO and browser page inventory include `/markets`.
- **Not yet implemented:** migrated database country keys, live localisation in job APIs/apps, NZ minimum wage assessment, NZ business registration, real NZ employer onboarding, NZ prices, billing, privacy/commercial counsel review, or first live job. Do not mark these done because the website knows about NZ.

## 3. Market-specific reference rules — counsel must confirm

| Area | Australia | New Zealand |
| --- | --- | --- |
| Country and currency | AU / AUD | NZ / NZD |
| Employer identity | ABN and authorised-representative review | NZBN or appropriate NZ entity/sole-trader validation; confirm exact eligibility method |
| Employment standards | Fair Work Act, National Employment Standards, applicable modern award or enterprise agreement | Employment Relations Act, Minimum Wage Act, Holidays Act, employment agreements and other relevant NZ instruments |
| Minimum pay | Award/classification-specific or other legally applicable minimum; effective-dated, employer confirms coverage | NZ adult minimum **NZ$23.95/hour** from 1 April 2026; starting-out/training **NZ$19.16/hour** in eligible circumstances. This is NOT a blanket award or salary calculator |
| Penalties and holiday pay | Modern award/enterprise agreement/contract as applicable; weekends/public holidays can vary | Do not transplant AU weekend penalty percentages; public-holiday work generally has at least time-and-a-half requirements, with other entitlements depending on ordinary working days and facts |
| Written agreements | Relevant Australian statutory requirements | NZ employees must have written employment agreements |
| Privacy | Australian Privacy Principles and applicable law | NZ Privacy Act 2020, including IPP 3A indirect-collection notice (effective 1 May 2026), IPP 12 cross-border disclosure safeguards |
| GST | AU GST treatment subject to accountant/tax review | NZ general GST 15%, registration often required on NZ$60,000 qualifying turnover over a 12-month window; cross-border service treatment needs NZ tax advice |
| Time zones | Multiple AU zones; venue supplies its IANA zone | Pacific/Auckland and Pacific/Chatham; venue supplies its actual IANA zone |
| Public holiday calendars | State and territory | National and regional anniversary days |

Official sources (last checked 2 November 2026):
- Australia: https://www.fairwork.gov.au/employment-conditions/awards/about-awards
- Australia: https://www.fairwork.gov.au/pay-and-wages/minimum-wages
- NZ wages: https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage/minimum-wage-rates-and-types
- NZ agreements: https://www.employment.govt.nz/starting-employment/employment-agreements
- NZ holidays: https://www.employment.govt.nz/leave-and-holidays/public-holidays/public-holidays-and-anniversary-dates
- NZ public holiday pay: https://www.employment.govt.nz/pay-and-hours/pay-and-wages/leave-and-holiday-pay/public-holiday-pay
- NZ privacy principles: https://www.privacy.org.nz/privacy-principles/
- NZ cross-border privacy: https://www.privacy.org.nz/privacy-principles/12/
- NZ GST: https://www.ird.govt.nz/gst/registering-for-gst ; https://www.ird.govt.nz/gst/what-gst-is
- NZ nondiscriminatory job ads: https://www.business.govt.nz/people-and-leave/advertising-and-hiring/advertising-positions-and-interviewing
These are engineering design references, not legal opinions, and must be refreshed immediately before launch.

## 4. Next engineering work — execute in order

### P0 — Requirements and business model (owner + counsel)

1. Confirm whether Australian operator can supply NZ online recruitment services without local registration, and whether any NZ tax or other registration is required.
2. Confirm NZ recruitment/intermediary classification and whether temporary shifts create labour-hire, employment, intermediary, immigration or payroll obligations.
3. Complete NZ privacy collection notices, transfer/data processor mapping, IPP 3A indirect collection assessment, NZ terms, complaints and deletion flow.
4. Review right-to-work checks without exposing visa/identity evidence unnecessarily; check local rules on protected characteristics and discriminatory advertising.
5. Decide NZ employer pricing **in NZD**, whether GST is included, invoices, currencies, refunds, merchant entity, payment-provider account and tax registration. Employees stay free.
6. Approve the NUA CREW mark and domains for New Zealand and Australia. Do not claim a NZBN/registered local entity until verified.

### P1 — Data foundations (backend + contracts + migrations, disabled until reviewed)

- Add effective country fields to employer legal entity, venue/location, posting, shift, pay assessment and billing address: ISO-2 `country_code`, immutable once financial/shift records exist without an audited correction.
- Distinguish profile residential country, search countries, permitted work countries, and job **workplace** country. Candidate may search across borders but one venue/job has one primary legal jurisdiction.
- For existing rows, migrate safely to `AU` **only when evidence establishes Australian origin**; audit ambiguous/missing records and do not assume.
- Introduce versioned `jurisdiction_rule_set` keyed by `country_code`, instrument ID, legal basis, effective start/end, source, reviewed-by and verification status. Fail closed on `supplied_unverified`.
- Preserve strict tenant RLS on new tables and any country-based employer membership. Country never replaces tenant boundaries.
- Extend OpenAPI, typed clients and Android/iOS clients together. Add round-trip and negative cross-tenant/country tests.

### P2 — Country adapters and pay (independent providers)

```ts
type CountryCode = string; // ISO alpha-2, checked against configured markets
interface MarketAdapter {
  code: CountryCode;
  currency: string;
  locale: string;
  businessIdentifier: { type: string; validate: (value: string) => boolean };
  timeZones: string[];
  capabilities: { posting: boolean; billing: boolean; shifts: boolean };
  assessPay: (input: PayAssessmentInput) => Promise<VerifiedAssessment | NotAssessed>;
  publicHolidays: (region: string, year: number) => Promise<HolidaySchedule>;
}
```

- AU adapter: retain Fair Work award classifications/enterprise agreements and confirmed rate sources; no regression of existing award hard blocks.
- NZ adapter: separate adult/starting-out/training applicability checks, minimum wage versioning, employment agreement and holiday logic. If required facts are unavailable, return `not_assessed` and block publishing; never default to AU classifications.
- All money in integer minor units and explicit ISO currency; reject adding or comparing amounts in different currencies without an explicit FX conversion boundary.
- Time calculations use IANA time zones and region-specific holidays, not server local time.

### P3 — Employer and employee UX (web, Android, iOS)

- Employer chooses operating country and workplace location explicitly before a posting. AU: ABN flow; NZ: NZ business-identifier workflow after eligibility rules approved.
- NZ forms display NZD, 4-digit NZ postcodes, local regional labels, local contact formatting and NZ-specific employment questions; AU forms retain existing meaning.
- Candidate searches one or multiple selected markets, sees currency codes beside pay and understands work-right eligibility. Do not share private nationality/immigration details with employers.
- Mobile/platform selectors must use a shared capability registry, not separate hardcoded AU/NZ forks.

### P4 — Billing, trust and policy review

- No AU Stripe price automatically reused as NZD. Configure explicit country price IDs and tax treatments under approved merchant and correct local regulatory advice.
- Keep payment flow OFF until checkout, webhook signature, refunds, taxes, receipts, disputes, per-country inventory and reconciliation are verified in sandbox.
- Build separate legal notices if necessary and human-readable distinction between site marketing and live product country availability.

### P5 — Controlled pilot and production rollout

- Run complete AU regression suite and independent NZ tests (privacy, pay, posts, applications, shifts, billing, tenant access, ID validation).
- Pilot one verified NZ employer and a small invited workforce only after counsel approval and consent; do not auto-import candidate resumes between markets.
- Introduce independent feature flags per country: `public_marketing`, `onboarding`, `posting`, `shift_matching`, `checkout`, `indexing`.
- Launch AU and NZ separately with an explicit release log and rollback; production traffic alone is not evidence of readiness.

## 5. Adding a third or fourth country

1. Add another ISO-2 entry with locale, currency, regions, time zones, identifier type, local labour compliance adapter, tax/merchant and privacy reviews, all capabilities disabled.
2. Add legal/audit evidence, tests, static market guidance and deployment checklist.
3. Only activate that market's capabilities after country-specific approval. **No new `if country === AU/NZ` branches in generic code.**
4. Preserve backward-compatible contracts, RLS tenant isolation, zero unsupported pay assumptions, and no change to existing countries' pricing.

## 6. Deployment and completion checklist

- Website marketing changes may deploy after review and green CI; they do **not** activate registrations, shift bookings, payments or public indexing.
- Required evidence: full website e2e across both light/dark, SEO metadata for `/markets`, mobile at 360px with no horizontal overflow, country registry unknown-country fail-closed tests, and Vercel READY.
- Record PR, merge SHA, deployment ID and what is **not** yet live in `docs/IMPLEMENTATION_TRACKER.md`.
