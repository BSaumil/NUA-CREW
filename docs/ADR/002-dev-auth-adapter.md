# ADR-002: Development-only local authentication

**Status:** accepted for development only; **must be replaced before any real user data.**

The brief requires managed OIDC/PKCE with MFA for privileged operators. No identity provider or credentials exist, so the API currently issues short-lived (30 min) HS256 JWTs after Argon2id password login. All authorisation is done server-side from the database (role, memberships), never from token claims alone. The API refuses to start outside `NUA_ENV=development` with the default secret. Replacing this means swapping token verification in `app/security.py`/`app/deps.py` for an OIDC verifier; routers do not change. No refresh tokens, email verification or MFA exist yet.
