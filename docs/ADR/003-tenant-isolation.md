# ADR-003: Tenant isolation — application checks plus Postgres row-level security

**Status:** accepted (supersedes the earlier "app-layer only" version).

**Layer 1 — application.** Every employer route resolves a membership from the URL's `employer_id` and the caller (`app/deps.py`); non-members get 404, not 403, so tenant existence is not revealed. Queries are then filtered by employer. A guardrail test (`test_every_employer_route_requires_membership`) fails if any `{employer_id}` route lacks a membership/admin dependency.

**Layer 2 — database (migration `b1c2d3e4f5a6`).** RLS is enabled and `FORCE`d on 19 tables. Policies read four transaction-local settings (`app.user_id`, `app.role`, `app.candidate_id`, `app.employer_ids`) set in `current_user` after authentication (`app/rls.py`). They vanish at commit/rollback, so a pooled connection cannot carry one caller's identity to the next. Anonymous requests see only non-draft jobs and public employer names. Employers see applications only for their own jobs and candidate profiles/resume versions only through those applications; candidates see only their own rows; notifications, audit, consent and ingestion tables are owner/operator-only.

**Explicit system scope.** The few writes that must cross tenants (registration, notifications, audit rows, resolving who to notify) run inside `system_scope(session)`. It flushes before and after so statements execute under the intended role. `audit()` and `notify()` do this themselves. Anything else needing `system` should be justified in review.

**Tests.** `tests/test_rls.py` runs deliberately *unfiltered* SQL under each identity and asserts which rows Postgres returns or refuses, plus a context-leak test. Because `users` must be readable to authenticate, it has no RLS; its API surface never returns other users.

**Known limits.** In development the app connects as the table owner, which is why policies use `FORCE`. Production must connect as a non-owner, non-superuser role (a superuser or `BYPASSRLS` role ignores RLS). Membership policies do not distinguish owner/recruiter/viewer — that remains an application rule. `INSERT … RETURNING` needs a matching SELECT policy, which is why cross-user inserts use `system_scope`.
