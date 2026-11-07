# NUA CREW — AWS staging plan-only workflow
**7 November 2026 · Prepared, not executed.**

Owner approved a **US$300/month target** conditioned on verifying actual costs and secure AWS access *before provisioning*. This is **not an approval to apply Terraform**. Nothing in this PR provisions AWS, connects an account, runs migrations, activates payments, or changes DNS.

## What is available
Manual GitHub Actions workflow: `.github/workflows/aws-staging-reviewed-plan.yml`. It runs **only from main**, with the protected `nua-crew-staging-plan` environment and a short-lived GitHub OIDC assumption of the plan-only role created by `infra/aws/state-bootstrap`. The role is not a deploy role. Workflow performs an exact AWS account match, encrypted S3+KMS backend initialization, validation, and a **plan with `enable_services=false` and empty ingress CIDRs**. No `apply` action exists. The plan file stays on the ephemeral runner and is removed; it is never uploaded as an artifact.

## Owner configuration required before running
1. Verify the **GitHub default branch is main** (it was still `claude/new-session-kszaxl` when checked). Verify Vercel's production branch and branch protections before changing it; manual workflows otherwise will not be accessible on the intended branch.
2. Select an isolated, owner-controlled AWS account; securely set up the AWS GitHub OIDC provider and the **read-only** account preflight from `docs/operations/AWS_STAGING_SECURE_ACCESS_2026-11-06.md`.
3. Obtain a current, **account-specific AWS Pricing Calculator estimate**, including Sydney NAT/ALB/RDS/Redis/Fargate/ECR/S3/KMS/CloudWatch/Secrets/IPv4/transfer/backup/tax. Recommended steady state **at or below US$240** for headroom; **NO-GO above US$300**. AWS Budgets alerts are not spending caps.
4. Separately approve and execute the **state bootstrap** from `infra/aws/state-bootstrap` on a trusted machine, with reviewed plan and private local bootstrap state. This is a **cost-bearing apply** and is not approved by the US$300 target alone.
5. Create GitHub Environment `nua-crew-staging-plan` with required reviewers and branch restricted to `main`. Configure these **environment variables**, not in code:
   - `AWS_STAGING_ACCOUNT_ID` (exact 12-digit ID)
   - `AWS_STAGING_PLAN_ROLE_ARN` (output from state bootstrap, exact-account OIDC role)
   - `AWS_STAGING_STATE_BUCKET` (bootstrap output)
   - `AWS_STAGING_STATE_KMS_KEY_ARN` (bootstrap output)
   - `AWS_STAGING_BUDGET_ALERT_EMAIL` (approved non-personal operations inbox)
   - GitHub Environment **secret** `AWS_STAGING_REDIS_AUTH_TOKEN` (securely generated, at least 16 characters; used for plan input only, never pasted into chat or committed)
6. Run the workflow manually from **main**. Confirm account identity, plan contents, no service activation, no open ingress, expected monthly spend and any permission errors. **Plan success does not grant apply permission.**

## Safety and limitations
- A Terraform plan **may read existing AWS resources and state**. It does not create staging infrastructure, but S3 state locking can create and delete a lock object. It must run only after the account, role and remote state are approved.
- The OIDC plan role intentionally lacks secret-value access and write permissions on managed resources. A real plan may fail due to insufficient describe permissions; review and adjust narrowly in a separate PR.
- The first AWS infrastructure apply would incur charges **even when `enable_services=false`**, because RDS, Redis, NAT and ALB are billable. Owner must review the full account-specific plan and costs and issue a **separate explicit apply approval**.
- No production database migration, NZ transaction, public employer/candidate activation, ClamAV document uploads, live Stripe or app-store release is authorised.

## Follow-up engineering
After an independently reviewed plan, prepare a separate human-approved apply mechanism, a one-off database role bootstrap/migration task, and secure Vercel-to-API connectivity. Do not expose a public ALB without authentication and approved ingress. Keep all 11 pilot evidence gates pending until backed by tests.
