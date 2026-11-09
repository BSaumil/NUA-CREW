# Staging acceptance runner

`services/api/scripts/staging_acceptance.py` drives the real HTTP API through the invitation-only
AU hiring journey with isolated synthetic accounts. It is **not** run by CI against any hosted
target and it never claims acceptance on its own: a report is `accepted` only if every step
passed, and the steps that cannot be exercised through the API are always listed as `blocked`.

## What it checks
Preflight (`/healthz`, `/readyz`, with the failure classified: function crash, Vercel challenge,
404, 503) → market catalogue (AU present, NZ has no transactional capability) → unauthenticated
requests refused → candidate + employer registration (duplicate email, duplicate ABN, bad ABN,
missing terms) → email verification (token replay refused) → admin verification of the synthetic
employer → draft job (not public) → publish → apply, idempotent replay, duplicate refused →
employer review and status change, rejection needs a reason → persistence on a fresh login →
cross-employer and cross-candidate IDOR → role escalation → concurrent applications (exactly one)
→ cleanup (job closed, synthetic candidates erased).

## What it will not do (always `blocked`, with the reason in the report)
Forced-RLS verification (use `db/roles/neon_bootstrap.sql -v post_migration=1`), missing Redis /
missing email provider (config-level; API tests), invalid redirect (Playwright), upload scanning.
Employer verification and email confirmation are `blocked` unless the owner supplies the inputs
below. A blocked step is never reported as passed.

## Guards (the runner refuses with exit 3 before sending any request)
- hosted targets must be `https`, listed in `NUA_ACCEPT_ALLOWED_HOSTS`, and repeated in
  `NUA_ACCEPT_CONFIRM_HOST`;
- `NUA_ACCEPT_EMAIL_DOMAIN` is required and may not be a public mailbox provider, so no live
  message reaches a real person (use a domain you control, or a reserved one when email is off);
- publishing needs `--allow-publish`; the job is closed again at the end.

## Inputs (environment, never committed, never printed)
`NUA_ACCEPT_ALLOWED_HOSTS`, `NUA_ACCEPT_CONFIRM_HOST`, `NUA_ACCEPT_EMAIL_DOMAIN`,
`NUA_ACCEPT_TOKEN_FILE` (JSON `{ "<synthetic email>": "<verification token>" }` read from a
controlled inbox), `NUA_ACCEPT_ADMIN_EMAIL` / `NUA_ACCEPT_ADMIN_PASSWORD` (an approved admin
identity), `NUA_ACCEPT_BYPASS_SECRET` (an owner-supplied Vercel protection-bypass value for the
protected deployment; do not use one you were not given). Registration must allow the synthetic
domain (`NUA_REGISTRATION_ALLOWLIST=@<domain>`); do not open registration.

```bash
cd services/api
uv run python scripts/staging_acceptance.py --base-url https://<staging-api-host> --allow-publish --out report.json
```
Exit codes: `0` all passed, `1` a step failed, `2` none failed but steps are blocked, `3` refused.
The report holds step ids and statuses only: no tokens, passwords or raw emails.

## Evidence status
Local self-test (`tests/test_staging_acceptance_selftest.py`, in-process API and a local
Postgres) passes the whole journey. It proves the runner logic only and is labelled
`local-selftest`. **No hosted run has been made**: the hosted API currently returns
`FUNCTION_INVOCATION_FAILED` (see `HOSTED_ACCEPTANCE_2026-11-09.md`).
