# Stripe sandbox setup and acceptance

Stripe Checkout is implemented for the employer web portal. Employee access remains free across Australia. No Stripe account has been connected and no provider payment has been made. Live keys are rejected; this source supports only disabled or test mode.

## Products

| Choice | Fixed AUD total | Coverage |
| --- | --- | --- |
| Advertisement or renewal | A$19 | 14 elapsed days |
| Promotion add-on | A$30 | Five elapsed days |
| New advertisement plus promotion | A$49 | 14-day ad, five-day promotion |

A$30 is implemented as an add-on, following the documented pricing assumption. Nothing automatically renews. The promotion audience is the matching state, suburb and category in relevance search. There are five reserved placements per audience. Candidate filters and manually chosen sorts still apply. Repeat promotions queue after existing coverage. Paid ad coverage must span the full promotion.

## Connect later

Use the owner's Stripe sandbox and deployment secret manager. Never commit keys or send passwords in chat. Set these API environment variables only after merchant terms and the tax display have been reviewed:

```dotenv
NUA_STRIPE_MODE=test
NUA_STRIPE_SECRET_KEY=<Stripe sandbox secret key>
NUA_STRIPE_WEBHOOK_SECRET=<signing secret for this endpoint>
NUA_BILLING_TERMS_APPROVED=true
NUA_BILLING_RETURN_URL=https://<employer-preview-host>/billing
NUA_PAID_ADVERTISING_ENABLED=true
```

The last switch enables paid publication enforcement and promotion ranking. Keep it off in existing development fixtures. It needs migration/reconciliation of existing free ads before any commercial rollout. The API and worker must use the same configuration. Do not enable checkout in a shared environment with the worker absent.

Register the public API endpoint `POST /v1/billing/stripe/webhook` in the same sandbox. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `charge.refunded`
- `refund.updated`
- `refund.failed`

Keep the webhook body unchanged through the proxy: verification uses the raw body and Stripe-Signature header. The API accepts only signed test events. Orders use server prices, stable retry keys and matching order metadata. Verified fulfilment retrieves the Checkout Session through Stripe before granting coverage. A return URL never grants coverage.

Run migrations with the schema-owning role; API and worker use the separate runtime role. Run `uv run python -m app.worker` continuously for expiry and unfulfilled-payment refund requests. The billing ledger is append-only and forced row-level security isolates employer records. The public promotion projection excludes financial and account data.

## Account-backed acceptance, still outstanding

1. In the configured sandbox, open `/billing` as a verified owner and buy each product with Stripe test payment details. Confirm exact amount/currency and one-time payment wording.
2. Confirm a successful signed webhook grants exactly one entitlement, even after retries and a browser refresh. A canceled or unpaid session must grant nothing.
3. Reserve all five slots simultaneously and verify the sixth purchase fails before Checkout opens. Expire/cancel an unpaid quote and verify capacity returns.
4. Complete payment after inventory expires and confirm no placement is oversold; an unfulfilled order must request and receive a refund.
5. Request a full refund; wait for confirmed provider status before asserting completion. Partial and failed refunds must show review needed. Check repeated and out-of-order events.
6. Verify renewal, repeat promotion, DST boundaries, expiry, unrelated employer denial, and read-only teammate restrictions.
7. Record actual sandbox event IDs and outcomes privately. The automated suite mocks external Stripe transport; it is not evidence of an account-backed payment.

Use Stripe's [fulfilment guidance](https://docs.stripe.com/checkout/fulfillment), [webhook signature guidance](https://docs.stripe.com/webhooks/signature) and [refund guidance](https://docs.stripe.com/refunds) when configuring the account.

## Release boundaries

The mobile apps show billing status and orders; they do not open a Stripe purchase flow. Native advertising/boost purchase policy and any store billing implementation require review before submission. No App Store compliance claim is made.

Live mode, tax invoices, dispute/chargeback operations, reconciliation dashboards and production activation remain separate work. Production identity, employer ownership/deletion, physical-device QA and signed store builds are also outstanding. Do not describe this sandbox integration as a completed public release.
