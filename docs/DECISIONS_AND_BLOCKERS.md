# Decisions and blockers

## Decisions (see `docs/ADR/` for detail)

1. Build NUA CREW directly in this empty repository.
2. Dev-only local password auth behind a replaceable boundary (ADR-002).
3. Tenant isolation enforced in application queries first; RLS deferred (ADR-003).
4. Next.js apps keep tokens in httpOnly cookies via server actions (ADR-004).
5. Ingestion fails closed without a recorded permission (ADR-005).
6. Test/seed emails use `example.com` subdomains because the email validator rejects `.test`.

## Blockers needing the project owner

| Blocker                                   | Needed for                                  | Who                         |
| ----------------------------------------- | ------------------------------------------- | --------------------------- |
| Identity provider choice + credentials    | Managed OIDC/PKCE, MFA for admins           | Owner                       |
| Brand clearance (IP Australia, ASIC, domains, handles) | Any public use of the name     | Owner + counsel             |
| ABN Lookup (ABR) GUID / approved verification vendor | Real employer verification      | Owner                       |
| Signed licences for any job feed          | Real ingestion                              | Owner / partnerships        |
| LLM provider + key and budget             | P3 Career AI, normalisation                 | Owner                       |
| Stripe sandbox keys                       | P5                                          | Owner                       |
| Apple/Google developer access             | P6 signing and store builds                 | Owner                       |
| Docker-capable machine/CI run             | Verifying `docker-compose.yml`, pgvector    | Owner / first CI run        |
| Legal review (Privacy Act, Fair Work, labour-hire, Spam Act) | Launch               | Counsel                     |

## Inputs referenced by the brief but not supplied

`docs/UI_COPY_AND_SCREENS.md` and the original `brand/svg/*` files were not in the upload. Only the app-icon PNG was supplied; `brand/svg/app-icon.svg` and `glyph.svg` are **vector recreations** of that PNG (not official artwork) and should be replaced by the authoritative files. The NUA master wordmark is rendered as text (Manrope) in the UI, per the brand note, until an official SVG is provided.
