# Account and billing brief (foundation only — billing is NOT enabled)

Source: owner decisions of 2026-10-27. Implemented so far: `GET /v1/pricing`, `GET /v1/pricing/estimate` (informational, public, tested). Nothing can be bought, no payment provider is called, no invoices are produced.

| Item | Decision |
| --- | --- |
| Employee access | Free in every state/territory on Android, iOS and web. No SKU, paywall or payment prompt. Never depends on employer payment. Charging is a roadmap option only (no date). The earlier A$10 employee price is not reintroduced |
| Employer account | No separate fee currently specified |
| Advertisement | A$19 / 14 days; re-advertise A$19 / 14 days (history retained) |
| Promotion | A$30 / 5 days, **add-on** (new ad + promotion = A$49). This interpretation is unconfirmed and shown in the API |
| Top-five placement | Reserved, capacity-limited inventory per clearly defined local category; not for sale; needs real concurrency enforcement before it can be |
| Renewal | Never automatic; each purchase needs explicit confirmation |

Unresolved: GST/tax treatment and tax invoices, channel (store/web) product setup, refunds, sandbox provider choice. Do not claim checkout is ready.
Order of work later: employer account → sandbox ad purchase (idempotent, audited) → promotion → reserved inventory.
