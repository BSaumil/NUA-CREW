# Threat model (initial)

| Threat                         | Control in place                                                                 | Gap                                              |
| ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| IDOR / cross-tenant access     | Membership dependency, scoped queries, 404 on miss, negative tests (API + e2e)    | No RLS (ADR-003)                                 |
| Candidate data leakage         | Candidate-only endpoints; employers see data only via applications               | Talent discovery not built (consent flag only)   |
| Credential attacks             | Argon2id, uniform login error, decoy hash, per-IP/per-identity limiter            | Limiter is in-process; no MFA; no lockout/breach check |
| Token theft                    | httpOnly cookie, 30 min expiry, no tokens in JS                                   | No refresh/revocation list                       |
| SSRF / hostile feeds           | `assert_safe_url`; no network connector exists; fixtures path-confined            | Size/decompression/timeouts untested (no fetcher)|
| Prompt injection via listings  | No LLM in pipeline; text inert; test proves no trust change                       | Re-test when LLM added                           |
| XSS                            | React escaping; descriptions rendered as text; markup stripped on ingest          | No CSP yet                                       |
| Tampering with history         | DB triggers block UPDATE/DELETE on events and audit                               | DB owner can disable triggers                    |
| Fake employers / spam          | Admin verification required to publish                                            | No ABR lookup, no rate limits on applications    |
| Dependency risk                | `pnpm audit`, `pip-audit` clean at time of writing; CI runs both                  | No SBOM, no secret scanning in CI                |
