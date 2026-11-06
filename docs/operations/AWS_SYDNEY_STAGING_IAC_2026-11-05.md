> **Update, 6 November 2026:** The owner approved a **US$300/month staging spending target**, conditional on the account-specific AWS quote and safe account access before provisioning. No infrastructure has been applied. See [cost envelope](AWS_STAGING_300_USD_COST_ENVELOPE_2026-11-06.md) and [OIDC read-only access](AWS_STAGING_SECURE_ACCESS_2026-11-06.md). Budget monitoring now includes 50% actual, 80% forecasted and actual, and 100% actual alerts; it is **not** a hard billing cap. The ALB target health check uses `/healthz` (liveness); `/readyz` remains the independent database-readiness probe.

# NUA CREW — Australia/Sydney isolated staging IaC

**5 November 2026 — review-only module. NO INFRASTRUCTURE APPLIED.**

This Terraform definition is a *proposed* AWS Sydney environment, not proof that staging works. Owner-authorised cost-bearing provisioning is required separately. It is intentionally non-production, cost-controlled and closed to inbound traffic by default.

## What is provisioned if an owner later approves `apply`
- VPC in `ap-southeast-2`, 2 public and 2 private subnets across AZs; public HTTPS ALB, private ECS tasks, one NAT for staging egress
- Private RDS PostgreSQL 16 with encryption, AWS-managed master secret, minimum 7-day backups, deletion protection and final snapshot
- Private ElastiCache Redis 7.1 with in-transit/at-rest encryption and a sensitive auth token
- Encrypted, versioned, public-access-blocked S3 bucket; **no ECS task access granted**, uploads OFF
- ECR image registry, ECS API/worker definitions (only if `enable_services=true`), 14-day CloudWatch logs
- AWS Budgets 80%-of-budget email alert; **not a hard spending cap**

**Caution:** NAT Gateway, RDS, ElastiCache and ALB accrue ongoing charges even with `enable_services=false`. Merely setting the flag false does NOT make infrastructure free. Do NOT run `terraform apply` without written owner approval and a current AWS cost estimate.

## Precise activation gates
1. Verify account identity, AWS budget/credit card owner, Sydney resource quotas, two availability zones, region and encryption policies. Owner approves recurring spend before any apply.
2. Set up an encrypted S3+KMS Terraform state bucket separately, with versioning, least privilege and state locking. The `backend "s3" {}` declaration intentionally blocks casual local-state apply. Initialise using a private `backend.hcl` excluded from git; do not print or publish state files.
3. Confirm the reviewed RDS/Redis engine minor versions and cost against AWS availability on the day of apply. Source is parameterised only where applicable.
4. Supply a strong Redis password as `TF_VAR_redis_auth_token` using a trusted, restricted environment. **Terraform state contains it**, so state access must be tightly controlled and encryption enforced. Never commit `.tfvars`, state or plans.
5. Start with `enable_services=false` and empty `allowed_https_cidrs`. The ALB security group then has **no ingress**, and the HTTPS listener and ECS task services are absent.
6. Operator bootstraps DB roles using `db/roles/bootstrap.sql` in a controlled one-off task. Configure `nua_runtime` as non-owner, NOBYPASSRLS; `nua_migrator` is for migrations only. Install required `btree_gist`, `vector` and `pgcrypto` if provider-approved. On a fresh **staging-only DB** rehearse Alembic before a real workload; no production mutation.
7. Populate AWS Secrets Manager `nua-crew-staging/application` JSON keys `NUA_DATABASE_URL`, `NUA_REDIS_URL`, `NUA_JWT_SECRET`, `NUA_CORS_ORIGINS` directly in AWS, **not Terraform, PRs or ChatGPT**. Ensure DB password roles and TLS Redis auth are correct.
8. Push the reviewed immutable container SHA to ECR. Set `image_uri` to `<ecr-repo>@sha256:<64-hex-digest>`; supply approved ACM certificate ARN and restrictive ingress source CIDRs. Require TLS, independent identity/session tests, and a trusted path for Vercel functions to access the private staging API. A public ALB with unreviewed signup endpoints is **not** permitted.
9. Only after 1–8, review plan again, then request explicit owner approval to set `enable_services=true` and apply. Worker and API run separately. The worker has no HTTP health endpoint: check progress, restarts and logs rather than using the API's /readyz.
10. Perform post-deploy incident/rollback, RLS cross-tenant, exact CORS allowlist, GET /healthz and /readyz, browser E2E, backup **restore** drill, expired sessions and mobile acceptance. Preserve all 11 formal pilot gates as pending until independently accepted.

## Design caveats
- Single NAT, single-zone RDS and one Redis cache node are **staging compromises**, not a production HA blueprint.
- The S3 bucket is private but not ready for document uploads: no ClamAV scanning, IAM task grants, signed URLs, deletion acceptance or malware outage testing. Keep upload UI disabled.
- API ingress defaults **closed**. Vercel protected frontends do not imply the API is protected. Approve a secure static-egress/VPN/access-layer design before opening ALB CIDRs.
- This module does not yet provision ClamAV, dedicated persistent audit storage, SMTP/push, managed recovery identity or app-store signing. These are explicit pilot blockers.
- ALB TLS certificate/DNS are inputs, not automatically created. No existing iksaa.com.au or NUA POS DNS is modified.

## Uncredentialed CI checks
```bash
cd infra/aws/staging
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate -no-color
```

GitHub Actions runs these commands with **no AWS credentials and no plan/apply** in `.github/workflows/aws-staging-terraform-validate.yml`.

## Owner's concrete next action
Provide approved AWS account access through a safe connector/role (never paste credentials), confirm the monthly spend ceiling and who receives budget alerts. Then infrastructure provisioning can proceed through a separately approved deployment step. Until then: **CONFIG-GO, HOSTED-STAGING-NO-GO**.
