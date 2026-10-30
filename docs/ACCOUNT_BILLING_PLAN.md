# NUA CREW — Accounts, advertisements and promotion billing
**Owner:** Sam / Saumil Bhatt  
**Date:** 27 October 2026, Melbourne  
**Status:** Implementation brief plus a tested pricing foundation. Android and iOS first. AI deferred.

## 1. Pricing direction and explicit assumptions

Current owner decision: employee access is free across all Australian states and territories. Employee charging is deferred with no activation date. Employer amounts are preserved below. Currency is assumed to be Australian dollars. This brief replaces the earlier speculative Starter/Growth/Business subscriptions as the initial commercial model. Do not add a recurring subscription or a placement commission.

| Item | Proposed charge | Service | Repeat purchase |
| --- | --- | --- | --- |
| Employee / job seeker access | Free | All Australian states and territories; permanent and temporary job seeking | No employee checkout or payment requirement |
| Employer account | No separate account fee proposed | Organisation, team and drafts | Ad charges are per listing, not per team member |
| Standard advertisement | A$19 | One approved listing for 14 days | Re-advertise for A$19 for another 14 days |
| Promotion add-on | A$30 | One listing in the relevant top-five promoted section for five days, subject to reserved inventory | Each additional five-day promotion costs A$30 |
| New standard ad plus promotion | A$49 | 14-day listing, first five days promoted | No automatic renewal |

**Draft assumption:** A$30 is an add-on to the A$19 listing. If the owner intended A$30 as an inclusive premium listing, change the versioned catalogue and examples before checkout implementation. Do not silently implement two conflicting price interpretations.

**Tax decision outstanding:** Determine GST registration and applicable tax treatment. Recommended commercial approach: keep the displayed totals at A$19 / A$30, inclusive of any applicable GST after accounting review, with a clear breakdown. Do not assert GST is collected or issue a tax invoice before this is established. Do not add unexpected platform fees at the final step. Show the actual store checkout currency and total; reconcile store price tiers before promising identical prices across channels.

**Future option only:** The earlier A$10 one-time concept is retained solely as a roadmap possibility. It is removed from the current catalogue and estimate actions. No employee paywall, store products, payment prompts or state-based exceptions. No automatic activation or promised future price. Revisit only after a fresh owner decision, legal assessment and store-policy review. Keep the generic billing architecture extensible without an active employee product. No paid candidate ranking, paid hiring priority or wage deductions.

## 2. Current implementation versus remaining work

Existing app already has candidate and employer registration, employer owner/recruiter/viewer memberships, employer verification, candidate profile controls, password change, export and candidate deletion. Mobile candidate settings already exist. Native employer mode and end-to-end billing are not complete.

This change adds:
- A versioned draft AUD catalogue, returned by GET /v1/pricing with explicit draft status, tax review pending and every product non-purchasable.
- Integer-cent estimates: new ad A$19, re-advertisement A$19, new promoted ad A$49, repeat promotion A$30. Employee access is explicitly free nationally and charging is disabled.
- UTC elapsed-duration helpers: 336 hours for a listing and 120 hours for a promotion, avoiding ambiguous daylight-saving arithmetic.
- A rule rejecting a full five-day promotion when listing coverage is too short.
- Thirteen isolated tests covering pricing, unavailable checkout status, duration boundaries, Melbourne DST and the read-only endpoint.

These are pricing foundations only. They do not take payment, persist orders, reserve promoted inventory, expire existing published jobs, enforce an employee paywall, restore purchases or grant account entitlements. No live billing, source publication or deployment is performed by this brief.

## 3. Employee account management

### Identity and security
- Sign up/sign in with verified email; support managed identity and social sign-in only when properly integrated.
- One person may seek permanent employment, temporary work or both without duplicate profiles or any employee fee.
- Secure sessions, device/session list, remote session revocation, password recovery, biometric app lock and account recovery.
- Email changes require verification of the new address and appropriate reauthentication; payment ownership must not be reassigned by editing an email.
- If using social login on iOS, review the applicable sign-in requirements. Avoid duplicate accounts when linking identities.
- A user who also hires should ultimately switch between a personal profile and organisation memberships, while personal job-seeking access remains free; the current single-role schema needs an explicit migration for this.

### Profile, choice and privacy
- Resumes and versions, certifications with expiry, experience, references with consent, work preferences, private pay expectations and availability.
- Separate permanent start date/notice period from weekly shift availability; recurring windows, date exceptions, travel limits and confirmed commitments.
- Preferred, followed and hidden employers; discoverability opt-in; clear limits on any “hide from current employer” protection.
- Contact details and exact availability visible only as authorised; no public worker location tracking.
- Candidate payment status must not be exposed to employers or affect hiring suitability.
- Access to notifications, applications, messages, account security, privacy controls and support must not be abruptly removed during a billing dispute.
- Accessible screens with meaningful labels, large text support, clear errors and keyboard-safe forms.

### Free employee access and future flexibility
- Registration, profiles, availability, permanent/temporary preferences and applications have no employee payment prerequisite in any state or territory.
- Reinstalling, changing device or returning to job seeking never triggers an employee charge under the current policy.
- No employee billing account, paid entitlement or restore-purchases screen is required for the current release.
- Keep generic versioned product/entitlement architecture extensible for a future separately approved offering. Do not add a toggle that can silently start charging employees.
- Any future offering requires a fresh owner decision, defined benefits, legal/tax/store review, clear terms and explicit purchase consent. Existing users are never automatically charged.

### Personal account screens
Account home → profile and work preferences → availability → privacy and employer choices → security and devices → notifications → export/delete → help.

Do not show an employee purchase page, payment prompt or “coming soon” fee banner. Employee access is free nationally for the current release.

## 4. Employer account management

### Organisation and venue model
- Business name, trading name, ABN where applicable, billing identity, authorised representative, venue locations and contact details.
- ABN checksum is not business verification. Moderation and identity review precede publication; paying never buys a verified badge.
- Owner can manage billing and team; recruiter drafts jobs and manages applicants; viewer reads permitted hiring records.
- Add a billing-manager permission if needed. By default only owner/billing manager purchases or requests refunds; recruiter access requires explicit delegation.
- Invitations expire and are single-use. Protect the final owner from leaving until ownership is transferred or closure is approved.
- Membership in one company never confers access to another company's candidates, orders or receipts.
- Multiple venues share the company billing account, but the advertised role and work location remain specific.
- Agency/multi-client operation needs distinct client authorisation and tenant boundaries; do not reuse a venue as a different legal employer.

### Employer account screens
Business overview → verification → venues → team/roles → ads and promotion calendar → applicants/messages/interviews → billing history and receipts → settings/security → close organisation/support.

Show listing state, live-until date, promotion start/end, renewal eligibility and any reserved campaign. Display outstanding refund/reconciliation status separately from job status.

### Advertisement scope
One ad covers one genuine role at one named venue/location or one clearly disclosed remote arrangement. An employer can disclose multiple vacancies for the same role; disclose the vacancy count. Distinct roles or venues normally require distinct ads. Approve exceptions before commercial release.

Use the same initial A$19 listing model for permanent and temporary opportunities. A temporary shift ending earlier closes at its actual end or when filled, even if 14-day coverage remains. Disclose this before purchase. Do not charge another per-worker or per-hire commission without a separate owner decision.

## 5. Advertisement lifecycle

Draft → moderation/verification → awaiting purchase → funded/ready → published → expired/filled/closed.

Payment and content approval are independent state machines. A funded listing is not automatically safe to publish. Prefer approval before payment when possible; otherwise explain the handling of funds and rejected ads before purchase.

- Start the 14-day service at actual publication, not registration, draft creation or time waiting for approval.
- Store instants in UTC; show date, time and employer timezone. Draft convention is exactly 336 elapsed hours; display the actual expiry before confirmation.
- Editing title, description and pay does not reset expiry or create free extra days. Material changes trigger review.
- Closing early stops applications and promotion serving. Keep received applications available according to retention and privacy rules.
- Re-advertising costs A$19 for new 14-day coverage, with new purchase and publication-cycle history linked to the original job.
- Renew an active unchanged ad from its existing expiry, so buying early does not discard unused days; after expiry, restart from actual republication.
- Renewed funding does not revive a filled or withdrawn role without explicit employer confirmation and any required review.
- Keep applications and messages linked to their original cycle. Do not send all previous candidates a new application or bulk message.
- Duplicate detection prevents overlapping copies of the same ad from flooding search or occupying multiple promoted slots.
- Use reminders, proposed at 48 and 24 hours before expiry, with channel preferences and no unauthorised automatic purchase.
- No “guaranteed applicants,” “guaranteed hire” or artificial urgency promises.

Search visibility must check live coverage in the query itself; delayed background jobs must not leave expired paid ads visible as active.

## 6. Delivering the top-five promotion promise

Unlimited sales cannot guarantee that every purchaser stays among five positions. Use **capacity-limited reserved slots**, not undisclosed rotation that weakens the owner's promise.

### Scope and placement
- Define a fixed booking bucket, initially locality/service area × canonical job category × permanent/temporary opportunity group.
- Display that exact audience and the five-day start/end before checkout.
- Each bucket has five numbered placements. Slots may rotate position within those five, but all five booked ads remain in that bucket's promoted section.
- Broader search spanning several buckets must show grouped promoted sections or another explicitly agreed design. Do not claim every ad is in the global top five for every query.
- Respect candidate filters, blocked employers, expired/filled jobs and basic relevance. Promoted status never overrides safety or candidate choices.
- Label every placement “Promoted.” Do not mix verification or “best employer” endorsements into that badge.
- An exact query/filter may have no relevant promoted matches; no promise of a view for every user.
- Campaign metrics show eligible impressions, clicks and applications without identifying viewers. No invented reach counts.

### Inventory and repeat promotion
- A$30 buys 120 elapsed hours for one ad, one defined bucket, one reserved slot.
- If all five slots are booked, offer the next available five-day interval or a waitlist. Do not charge for unavailable immediate placement.
- Show placement dates before purchase, then reserve inventory briefly during checkout. The hold duration is configurable and clearly shown.
- Recheck and lock inventory atomically at fulfilment; concurrent purchase attempts cannot oversell the fifth slot.
- Additional A$30 campaigns require fresh inventory confirmation. They may be back-to-back, never overlapping for the same ad/bucket.
- A repeat promotion does not renew the standard listing.
- Full listing coverage must extend through the campaign end. If only four listing days remain, require the A$19 renewal before booking five promoted days; show both line items rather than quietly truncating delivery.
- Changes to category or locality cannot move paid inventory to another bucket without rebooking and availability checks.
- Limit a duplicated role/employer from monopolising the section; initial recommendation one promotion per employer in a bucket at a time, subject to owner review.

Use half-open intervals [start, end), allowing one campaign to end exactly when another begins. Persist slot reservations with a database overlap constraint per bucket and slot, plus a uniqueness rule preventing duplicate active campaigns for a listing/bucket. Application-only “count then insert” checks are insufficient under concurrency.

An arbitrary search-radius definition can overlap other radii; use canonical service areas and an explicit display contract to keep inventory countable.

## 7. Payments, receipts, refunds and service recovery

### Channel policy
- Web checkout can use an approved payment processor in sandbox first.
- Apple explicitly requires in-app purchase for ads/boosts consumed in the same app; its separate advertising-management-app exception is narrower and must not be assumed to cover NUA CREW.
- Google generally requires Play Billing for paid in-app digital features, subject to its current exceptions/programmes.
- Design iOS, Android and web provider adapters around one server entitlement ledger; confirm current market-specific policy before implementation.
- Do not add a native “pay on website” button to bypass store rules. Do not assume all ad-related purchases qualify as physical employment services.
- Use server verification, restore/reconciliation, refund notifications and store product mapping. A successful client animation or checkout redirect is never proof of payment.

### Required behaviour
- Create an immutable order with employer/account, listing, catalogue version, amount in minor units, currency, tax treatment, channel and intended service interval.
- Record exact terms and the checkout total before charge; no editable browser-supplied price.
- Scope idempotency keys to actor, tenant and action. A changed payload under the same key must conflict.
- Verify provider signatures and environment; deduplicate provider event IDs and transaction IDs.
- Handle duplicated, delayed and out-of-order payment and refund events.
- Fulfil once in a database transaction with entitlement and outbox records. Retrying must not add another 14 days or another promotion.
- If a late payment succeeds after its inventory hold expires, do not steal another booking. Offer an explicitly accepted new slot or refund to the original payment route.
- Never activate on pending/failed payment, and never silently downgrade the purchased service.
- Mark receipts as processor/store receipts; issue tax invoices only with the correct business/tax details. Provide downloadable transaction history and refund references.
- Separate payment state (pending, paid, failed, refunded, disputed) from listing and campaign state.
- Reconcile with each provider regularly; alert operators to money-without-service and service-without-valid-payment anomalies.

### Draft refund and compensation policy
Subject to the applicable consumer law, store processes and final published terms:
- Duplicate charge: investigate and refund the duplicate through its original channel.
- Rejected advertisement never published: full refund or employer-chosen credit; do not force credit where a refund is owed.
- Promotion inventory unavailable after payment: refund or a new interval accepted by the employer.
- Platform outage preventing the purchased placement: measured extension or refund of undelivered service, handled consistently.
- Voluntary early closure because the position is filled: disclose the policy before purchase; suggested no discretionary refund solely because of a successful early hire, without excluding statutory remedies.
- Moderation removal, fraud and chargebacks need auditable case review; avoid blanket “no refunds under any circumstances.”
- Optional internal credits are non-transferable service credits, not a withdrawable wallet; defer them until accounting and policy are settled.
- Worker wages, superannuation and timesheets are separate from advertisement charges. Never offset these fees against worker wages.

## 8. Privacy, deletion and support

- Employer closure requires owner verification, team handover or removal, ending ads and campaigns, and resolving pending purchases/refunds.
- Candidate account deletion remains available in-app; adding payments must not turn deletion into a support-only obstruction.
- Financial records may require retention distinct from operational profile data. Obtain a documented retention schedule and explain it in export/deletion flows.
- Restrict retained receipts and dispute evidence to authorised staff; do not retain the whole resume to support a transaction.
- Export the user's relevant orders, receipts, entitlements and refund history without leaking co-workers' or applicants' personal data.
- Deletion should stop serving ads or profiles promptly while scheduled financial settlement can finish through minimised records.
- Provide report-ad, dispute-charge, appeal and account recovery flows with visible case status.
- Security controls: owner/billing changes require reauthentication, audited role changes and rate limits; no full payment tokens or secrets in logs.

## 9. Proposed data model

Reuse existing users, candidate_profiles, employers, locations, memberships, jobs and audit events. Introduce only missing concepts.

| Entity | Purpose and critical invariants |
| --- | --- |
| price_catalog_versions / products | Approved effective version, AUD minor units, tax treatment, channel product mappings; immutable purchased snapshots |
| billing_accounts | Personal or organisation owner; provider references; tenant isolation |
| orders / order_lines | Exact proposed service and price; status; terms version; actor; tenant-scoped idempotency |
| payment_transactions / provider_events | Verified environment and transaction/event deduplication; immutable history |
| account_entitlements | Generic future extension point; current employee access is free and never depends on a paid entitlement |
| listing_publication_cycles | Funding, listing snapshot, starts/expires, renewal linkage, moderation status |
| promotion_buckets / slots | Canonical search scope and maximum five slots |
| promotion_holds / campaigns | Expiring checkout reservations and non-overlapping paid service windows |
| refunds / disputes / adjustments | Original provider route, reason, amount and audit history |
| outbox_events | Exactly-once business effects with retryable delivery, not a claim of exactly-once networking |

Enforce RLS on every tenant/customer table and narrow service privileges. Financial rows must not cascade-delete when a profile is erased; design lawful retention and unlinking first. No user-editable “has_paid” field.

## 10. Delivery phases for Claude Code

### A — Account foundation and policy reconciliation
Inspect the existing auth and settings screens; integrate the current local resilience fixes before rewriting them. Resolve the single-role versus role-switching migration, implement employer account settings and safe ownership transfer, and align all pricing copy with this brief. Keep employee access free across all states and territories; employee monetisation is a future option only. Preserve native-first priorities.

### B — Sandbox standard advertisement purchase
Create order/ledger schema and RLS; wire approved provider sandbox; support A$19 purchase, verified receipt and 14-day publication coverage. Add native billing adapters after policy/product setup. Implement expiry enforcement, explicit renewal, receipts and recovery without manual database edits.

### C — Reserved promotion inventory
Build the exact bucket/search display contract, five-slot booking calendar, checkout holds and overlap constraints. Implement A$30 promotion and repeat promotion with coverage validation, concurrency tests and failed-inventory refunds. No public top-five promise before this is verified.

### D — Native account and employer operations
Complete iOS/Android account, team and billing screens, purchase restoration, account role switching and employer job controls. Test purchases, refunds, reinstall, device switching and offline-to-online recovery using store sandboxes and real devices.

### E — Pilot and commercial activation
Finish legal/tax decisions, consumer terms, support/refund operations, moderation and device evidence. Review the still-open dependency audit issue and other release blockers from the prior review. Request separate authorisation only when there is a concrete reviewable release and live-billing configuration. No production activation is authorised here.

Availability/preferences from the earlier master plan remain a parallel product priority; avoid a broad rewrite or holding the entire candidate experience behind unfinished billing.

## 11. Acceptance checks

1. Employee access is free on Android, iOS and web in every Australian state and territory, with no employee paid-access product in the catalogue.
2. Permanent and temporary preferences, registration and applications never require employee payment.
3. Viewer/recruiter without delegated billing permission cannot buy, refund or read restricted billing records.
4. Tenant A cannot access tenant B's order, receipt, slot booking or applicants, including by guessing UUIDs.
5. A standard purchase starts 14-day coverage only at actual publication.
6. Repeat webhook and checkout retries cannot double-charge through our request handling or double-extend coverage.
7. An ad plus one promotion totals A$49 under the add-on interpretation; existing-ad repeat promotion is A$30.
8. More than five simultaneous booking attempts cannot allocate more than five matching slots.
9. A promotion ending at ad expiry is allowed; one ending a microsecond later is rejected or explicitly paired with a renewal.
10. Re-promoting never silently renews an ad or extends unrelated listings.
11. Re-advertising preserves applications and history while making the new paid cycle explicit.
12. Search hides expired/filled/blocked ads even if expiry workers or promotion workers are delayed.
13. Late success after a hold expires follows compensation/rebooking, never overselling.
14. Refund/revocation notifications reconcile correctly even when events arrive out of order.
15. Account export/deletion respects both privacy and the documented financial retention policy.
16. Restore verifies account ownership, rejects a transaction claimed by a different user, and handles store account mismatch with a safe recovery flow.
17. Large text, screen readers, keyboard navigation and payment-cancel paths work on both platforms.
18. No native screen falsely indicates payment succeeded; sandbox mode is clearly distinguishable.
19. Ad renewal and promotion have separate reminders and never charge automatically.
20. Platform fees never appear as worker wage deductions or proof of award compliance.

## 12. Ready-to-paste task for Claude

Implement NUA CREW account management and sandbox advertisement billing using docs/ACCOUNT_BILLING_PLAN.md as the current commercial brief. Android/iOS first, AI deferred. Employee access is free in every Australian state and territory. Remove employee fees from current catalogues and estimates. Retain monetisation only as a future roadmap option requiring a fresh owner decision; do not build employee checkout or payment gates. Build A$19/14-day ads and A$30/5-day promotion as separate products; assumed new promoted ad total A$49. Start by reconciling local-only fixes, current account settings, role schema and billing policies. Implement Phase A then B as a tested vertical slice; do not claim the pricing catalogue alone is working checkout. Preserve tenant RLS and verified business approval. Do not sell top-five inventory until bucket/display semantics and database concurrency controls are implemented. No recurring charges, live payments, production deployment, main merge or GitHub publication without the required separate authorisation. Report implemented screens/APIs, migrations, exact test evidence and remaining external decisions.

## 13. Sources checked on 27 October 2026

- NSW Government — Running an employment placement service in NSW: https://www.nsw.gov.au/business-and-economy/running-a-business/industry-specific-business-requirements/running-an-employment-placement-service
- Queensland — Private Employment Agents (Code of Conduct) Regulation 2026, particularly fees provisions: https://www.legislation.qld.gov.au/view/whole/html/inforce/2026-09-01/sl-2026-0092
- Apple — App Review Guidelines, including 3.1.3(g) advertisements/boosts consumed in the same app: https://developer.apple.com/app-store/review/guidelines/
- Google — Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en

These sources establish concrete issues to assess; they are not a completed legal opinion for NUA CREW's model. State-specific fees and store rules must be rechecked before live activation.

