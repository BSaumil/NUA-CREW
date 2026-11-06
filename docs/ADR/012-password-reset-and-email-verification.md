# ADR-012 — Password reset and email verification

Status: accepted (2026-11-05), pending owner decisions listed below. Builds on ADR-002 (dev auth placeholder), ADR-003 (RLS) and ADR-007 (mobile auth).

## Decisions

**Single-use, short-lived, hashed tokens.** `auth_tokens` holds a SHA-256 hash of a 256-bit random token (never the token), the purpose (`password_reset` 30 minutes, `email_verification` 24 hours), the user, and for verification a snapshot of the address being confirmed. A new request retires older unused tokens of the same purpose. Tokens are consumed under a row lock, so a link works once. Unknown, used, expired and wrong-purpose tokens all return the same `invalid_or_expired_token` error. The table is `FORCE` row-level-secured with a system-only policy: even a signed-in user cannot read or write it through the runtime role.

**No account enumeration.** `POST /v1/auth/password/forgot` always answers 202 with the same body, for known, unknown and inactive addresses, and applies the same per-address and per-IP limits to all of them. Unknown and inactive addresses are handled with no stored token and no email. The only variable in the response is `email_delivery`, which describes this deployment, not the account.

**Reset ends every session.** Completing a reset sets a new Argon2id password, revokes every refresh token (all devices), marks the address verified if it was not (the person just proved control of it), retires other reset tokens, writes an `auth.password_reset_completed` audit event and sends a plain notice email. Changing a password in settings sends the same notice when email is on. Existing access tokens remain valid until their 30-minute expiry (see the threat model).

**Verification binds to the address.** A confirmation link verifies only the address it was issued for; if the account email changed since, the link is rejected. Registration (candidate and employer) sends a verification email in a background task; a failed send never fails registration.

**Email transport is an adapter with no provider chosen.** `NUA_EMAIL_PROVIDER` is `none` (default; nothing is sent, nothing is issued, the UI says email is not switched on) or `file` (development only; writes JSON files with mode 0600, used by e2e). Outside development a non-`none` provider requires https public URLs. A real provider (SES, Postmark, etc.) is an owner decision and a new `EmailSender` implementation; the rest of the code does not change. Send failures are logged without the message body or link.

**Honest UI.** Web and mobile show "Confirm your email" only when the address is unconfirmed and `email_delivery` is true, and say "email is not switched on in this environment yet" instead of pretending to send. Link pages set `no-referrer`, `noindex`, and verification requires pressing a button so mail scanners prefetching a link do not consume it.

## Not decided / not done
- Email provider, sending domain, SPF/DKIM/DMARC and the From address (owner decision; nothing is sent today).
- Whether an unverified address should block publishing a job or applying. Today verification gates nothing.
- Links open in the browser, not the mobile app (no universal links yet).
- No MFA, no breach-password check, no access-token revocation list.
