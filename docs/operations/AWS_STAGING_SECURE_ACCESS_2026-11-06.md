# NUA CREW — secure AWS account handoff for staged Sydney preflight
**6 November 2026 · No credentials accepted in ChatGPT or GitHub repository.**

## Purpose
The product owner approved a target of **US$300 per month** for AWS staging, *conditional on current AWS cost validation and a secure account connection prior to provisioning*. The repository currently has a design-only module `infra/aws/staging/`; **no Terraform plan, apply or real cloud staging deployment has been performed**.

Our first connection needs **read-only**, short-lived access, not administrator permissions or a copied access key. GitHub Actions can assume a dedicated AWS IAM role using **OIDC** after owner setup. The manual workflow `.github/workflows/aws-staging-readonly-preflight.yml` only reads account identity, Sydney availability zones and RDS/Redis offerings. It cannot provision, deploy, run migrations or bill Stripe.

## Critical GitHub default-branch prerequisite

**Verified on 6 November 2026:** the repository's default branch is still `claude/new-session-kszaxl`, while the correct integrated/released development branch is `main`. GitHub only enables the manual `workflow_dispatch` workflow when its YAML exists on the default branch. A repository administrator must change **Settings → General → Default branch** to `main` after checking branch-protection, Vercel Git integration and contributor automation effects. **Do not** mirror the workflow into the stale branch, force-push, delete that branch or bypass environment reviewers. The currently connected GitHub actions do not provide the repository-settings write operation, so this admin change is an external owner action.

See GitHub's documentation: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

## Owner setup — perform only in your AWS and GitHub consoles
1. Decide which dedicated AWS account (preferably a separate staging account) will own NUA CREW. Verify its payer/billing owner and whether the existing AWS account already has chargeable resources. **Do not share passwords, access keys or session tokens in chat.**
2. In AWS IAM, create/verify the GitHub OIDC identity provider `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`. If it exists, **reuse** the provider; do not create a duplicate.
3. Create a role named, for example, `NUACrewStagingReadOnlyOIDC` with trust restricted to **this repository and the protected environment**. Substitute the AWS account's real provider ARN for `<AWS-ACCOUNT-ID>`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<AWS-ACCOUNT-ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:BSaumil/NUA-CREW:environment:nua-crew-staging-readonly"
      }
    }
  }]
}
```
4. Attach only this example **read-only identity/service-availability policy** (resource-wide `Describe*` is required by these public metadata APIs, but no write actions are granted):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:DescribeAvailabilityZones",
      "rds:DescribeOrderableDBInstanceOptions",
      "elasticache:DescribeCacheEngineVersions"
    ],
    "Resource": "*"
  }]
}
```
This role is **not** a Terraform plan role, deploy role or pricing/billing role. Granting it `AdministratorAccess`, RDS mutation, IAM writes, `terraform apply`, or access to secrets is not permitted. `sts:GetCallerIdentity` is available for identity verification without an explicit policy grant.
5. In repository `BSaumil/NUA-CREW`, create a GitHub Actions **Environment** called `nua-crew-staging-readonly`. Require a trusted human reviewer and restrict deployment branches to `main` if those settings are available. Note: environment approvals and configuration are separate GitHub administration tasks, **not created by the code in this PR**.
6. Add *environment variables* (not source-code constants): `AWS_STAGING_ACCOUNT_ID` (the 12-digit AWS account number) and `AWS_STAGING_READ_ROLE_ARN` (full ARN of the read-only role). Do not set any root or long-lived AWS keys. These IDs are non-secret identifiers but should still be managed in the protected environment.
7. **Only after the PR is merged to `main`**, manually run GitHub Actions → **aws-staging-readonly-preflight** → **Run workflow** on `main`. The job fails closed without the environment and role, checks that the assumed AWS account is exactly the approved one and reports only its last four digits in logs. No AWS resources are created or charged by the workflow; ordinary service/API request billing policies may still apply.
8. Before any later Terraform plan, supply the same approved 12-digit ID as the **private** `expected_aws_account_id` Terraform variable; `allowed_account_ids` in the AWS provider rejects plans or applies against the wrong account. Do not commit a real account ID in a public sample.
9. Review the job output with the owner. Request a separately scoped **read-only cost/account audit role** if actual existing usage is to be inspected; do not silently broaden the preflight role. Validate the AWS Pricing Calculator estimate using the actual account. Retain restricted staging account ownership and backup policies.

## Next distinct step — not authorised by this OIDC preflight
- Owner chooses the exact monthly recurring quote and an alert email (do not publish a personal email address in the repository).
- Approved Terraform S3/KMS state, locking and identity roles are prepared. `terraform plan` uses a **different limited role** with carefully reviewed read and state access; it is **never** run from a PR with untrusted changes.
- To apply resources, use an independently reviewed environment and a time-bounded deploy role with mandatory human approval, exact immutable SHA, estimate/account confirmation and explicit written change record. `enable_services=false` still incurs NAT/RDS/ALB/Redis charges if base resources are applied. The first `apply` is not covered by the read-only role.
- After cloud staging exists, run migration/backups, RLS/tenant tests, the full hiring journey and protected frontend connectivity. **Never** mark release gates as passed from an OIDC identity check.

## Operational risks
- AWS Budgets are lagged alerts, not reliable spending cutoffs. Review the US$300 ceiling in `docs/operations/AWS_STAGING_300_USD_COST_ENVELOPE_2026-11-06.md` and set a manual shutdown playbook.
- Do not use an OIDC trust rule with `repo:BSaumil/NUA-CREW:*` or `*` branches; restrict to this exact protected environment. Github admin must ensure the environment cannot be approved by an untrusted actor.
- NUA POS, Railway, production databases, NZ transactions, live Stripe and public hiring remain entirely out of scope.

**Owner's immediate step:** connect the approved AWS account to the protected GitHub environment using the role above; no secret value should be pasted in ChatGPT. If this is not feasible, provide account-safe status only and keep staging provisioning **BLOCKED**.
