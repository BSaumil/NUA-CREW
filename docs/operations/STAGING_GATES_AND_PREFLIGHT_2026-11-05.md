# NUA Crew — next staging gate and non-destructive migration preflight
**Date:** 5 November 2026 · **State:** implementation preparation only, not a production migration or a cloud deployment.

## What is already complete
- PR #32 integrated the hiring journey and fixed historical availability leakage; browser, API, web, native CI passed.
- PR #33 merged the A$49/14-day advertisement and A$79 bundle (A$30 five-day boost) with `d66e11cc1006` migration; old order values remain allowed. This code is not proof that the new revision ran on production.
- PR #34 merged API/worker non-root Docker packaging and CI.
- Vercel marketing project operates separately. Candidate and employer projects exist with authentication protection; their API integration needs a real staging endpoint.

## Immediate safe action: read-only SQL
Run `db/preflight/20261105_country_pricing_readonly.sql` against **the actual target database** using an authorised maintenance account that can see all rows. Never infer no rows merely from a tenant-isolated application role. Install `psql` on a controlled, access-restricted host; credentials via a secret manager, never shell command arguments or a GitHub issue.

```sh
# PGHOST, PGPORT, PGDATABASE, PGUSER and optionally PGPASSFILE are configured
# by the operator using a short-lived database identity and secret manager.
psql -X -v ON_ERROR_STOP=1 \
  -f db/preflight/20261105_country_pricing_readonly.sql \
  > private-preflight-output.txt
```

The SQL starts `BEGIN TRANSACTION READ ONLY`, applies 20-second statement and two-second lock timeouts, and returns aggregate evidence only. **The output is sensitive operational data**. Store it in an access-restricted change record; never attach full database metadata to a public PR.

### Decisions supported by the output
1. Is `locations.country` populated only with uppercase two-letter codes? `NULL` is allowed by the existing CHECK expression; count NULL separately and do not assume it verifies location provenance.
2. What is the currently applied Alembic revision? Is the database already on `a44b95ef1004`, `c55d06a11005` or `d66e11cc1006`? Confirm head and branch.
3. How large are `jobs`, `locations`, `billing_orders` and related tables? Current `c55d06a11005` creates several CHECK constraints and a non-concurrent `jobs` index; estimate lock duration on an **anonymised staging clone**, not production.
4. What exact historical `billing_orders.amount_minor` values exist? New `d66e11cc1006` accepts 1900, 3000, 4900 and 7900 cents. Never silently rewrite settled orders.
5. Is the `nua_runtime` role non-superuser/NOBYPASSRLS, and do protected tables have RLS enabled and FORCE RLS where required? A passing SQL report is not a substitute for cross-tenant adversarial tests.
6. Have backup/PITR restore and rollback rehearsals been successfully completed, with measured RPO/RTO? A backup existing is **not** a successful restore test.

### Migration policy
- **Production NO-GO** until full preflight, validated backups, lock/rollback design and separate owner approval.
- Do not rewrite a published migration ID that may have run on a shared database; assess checksum/history first. If none applied, plan controlled index/constraint sequencing; if some applied, design a forward-only reconciliation. A follow-up migration cannot retroactively remove locks from an earlier unapplied revision.
- Prefer a controlled roll-forward over dropping columns holding real country/ruleset data. No blanket legacy AU relabelling.
- If the existing migration blocks on bad location codes, remediate through a separately reviewed data correction with provenance; don't disable verification silently.

## Staging deployment sequence
1. Provision an approved AWS Sydney isolated `nua-crew-staging` environment with budget limits: RDS 16+pgvector, Redis, ECS Fargate API and worker, restricted security groups and Secrets Manager. Keep scanner/document storage disabled until S3/ClamAV provider acceptance.
2. Configure the two Vercel applications only after API HTTPS staging DNS is verified. Avoid `localhost` fallbacks in server/browser settings; set exact cross-origin allowlists and remain behind Vercel authentication.
3. Build identical reviewed SHA image for API+worker, run migration from dedicated `nua_migrator` role on *isolated staging*, and reject unsafe runtime roles.
4. Run `/healthz` and `/readyz` plus real-RLS employer/candidate E2E, time zone, tenant isolation, worker sweep, incident logging, backup/restore and rollback test on same SHA.
5. Record linkable non-secret evidence in `docs/reports/RELEASE_CANDIDATE_REVIEW_PACKET.md`, keeping any missing 11 pilot gates pending.

## Owner/infrastructure approvals needed before the actual hosted API can be declared GO
- AWS Sydney account and selected spending budget; authorised ECS/RDS/Redis/S3 provisioning role (do not share credentials in chat).
- DNS/CORS exact staging hostnames, TLS certificate and Vercel frontend connection approval.
- Confirm production migration target and backup owner. No production write has been approved.
- Stripe test environment, document provider and real-device acceptance are separate gates; no live charging or NZ activity.

**Decision:** Preflight/code-package GO; AWS and production rollout **BLOCKED by access and provisioning evidence**.
