# New Zealand readiness gates (4 November 2026)

**Current state: preview only.** NZ is shown as "being prepared". Nothing is saved, published, booked or charged for NZ, and the API rejects NZ onboarding, job publishing and shifts.

## What is in place
- UI preview in `en-NZ` with NZD and region labels, NZBN help text, and a disabled submit with the reason; server actions reject NZ before any API call.
- Backend capabilities for NZ all off; the Australian award engine refuses NZ employers and jobs.
- Mixed-country search labels each amount with its ISO currency and never combines them.

## Gates before any NZ capability can be enabled (all currently OPEN)
| Gate | Needed |
| --- | --- |
| Employment rules | Verified NZ sources (Employment New Zealand and legislation), effective dates, a separate NZ rule provider; nothing derived from Australian awards |
| Wage guidance | A verified NZ minimum-wage and entitlements ruleset, with "not assessed" wherever data is missing |
| Business verification | A decision on NZBN or another check; the current UI text says this is undecided |
| Legal entity and tax | NZ commercial identity, GST position, privacy and terms for NZ; counsel and accountant input |
| Pricing and billing | NZ prices set by the owner; none inferred from AUD; Stripe not enabled |
| Regions and addresses | Backend region codes and postcode rules for NZ |
| Release approval | Explicit written owner approval per capability |

## Do not
Show NZ wage figures, claim NZ compliance, accept NZ employers or listings, charge in NZD, or index NZ pages as if the market were live.
