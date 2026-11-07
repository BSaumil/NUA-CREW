# Owner decisions, 2026-11-07

Recorded as given by the owner. Implementation notes say what the code does and what it does not.

| Decision | Owner's choice | What the code does |
|---|---|---|
| Role required to publish a job | Yes | `require_role_on_publish` defaults to on. A direct job cannot publish without a hospitality role and a current pay check. |
| Who verifies award/pay rates | A person, through admin | Unchanged: rates stay `supplied_unverified` until an admin verifies them. Nothing is filled in automatically. |
| ABN at employer sign-up | Required | The API, the employer website and the app all require an ABN. It must be 11 digits with a valid checksum and not already registered. A well-formed number is **not** verification: the organisation stays `unverified` until an admin reviews it. |
| Email verification | Gate posting and applying | Creating or publishing a job, and applying, need a verified email. |

## The email gate and the missing mail provider

No email provider is approved (ADR-012), so nobody can receive a verification link yet. Enforcing the
gate regardless would lock every account out of posting and applying. The gate is therefore active
only while email can actually be delivered (`services/verified_email.gate_active()`): the setting
`NUA_REQUIRE_VERIFIED_EMAIL` is on by default, and it takes effect as soon as `NUA_EMAIL_PROVIDER` is
set to a real transport. The user-facing message never claims an email was sent when none can be.

Before switching a provider on, check that existing accounts can verify (the reset-password flow also
verifies an address) and that support has a way to help someone who never receives the link.

## Not decided here

Terms links in the app sign-up, pricing wording at sign-up, and the choice of email provider remain
open owner decisions.
