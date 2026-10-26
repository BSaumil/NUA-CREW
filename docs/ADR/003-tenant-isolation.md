# ADR-003: Tenant isolation without RLS (for now)

**Status:** accepted, with RLS tracked as follow-up.

Every employer route resolves a membership from the URL's `employer_id` and the caller (`app/deps.py`); non-members receive 404 (not 403) so tenant existence is not revealed. Queries then filter by that `employer_id` (jobs) or join through the employer's own jobs (applications). Negative tests probe guessed IDs through both the caller's tenant path and the victim's path. Risk: a future query that forgets the filter. Mitigation planned: Postgres RLS keyed on a per-request setting, plus a test that enumerates every employer route.
