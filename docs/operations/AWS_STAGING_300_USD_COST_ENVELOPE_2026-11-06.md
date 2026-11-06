# NUA CREW — AWS Sydney staging: US$300 cost envelope
**Date:** 6 November 2026 (Australia/Melbourne)  
**Status:** indicative public-price estimate; **NOT** an AWS account-specific Pricing Calculator estimate, invoice, `terraform plan`, or permission to apply.
**Owner decision:** monthly **US$300 staging spending target**, conditional on reviewing actual estimated costs and obtaining secure AWS account access *before provisioning*. This is **not** a guaranteed spending cap.

## Configuration examined

`infra/aws/staging` on `main` after PR #37: `db.t4g.small` RDS PostgreSQL 16, `cache.t4g.small` single-node Redis, one NAT gateway, one public ALB, one continuously running x86 Fargate API task (**0.5 vCPU / 1 GiB**) and worker (**0.25 vCPU / 0.5 GiB**). Both private, `enable_services=false` by default. Storage begins at 20 GiB gp3, with a separate review before any increase. No actual AWS infrastructure has been provisioned.

## Indicative 730-hour Sydney on-demand baseline

| Meter | Published/observed unit assumption | Calculation | Monthly USD |
| --- | --- | --- | ---: |
| RDS `db.t4g.small` single AZ | $0.051/hr | 730 × 0.051 | **37.23** |
| ElastiCache Redis `cache.t4g.small` | $0.048/hr | 730 × 0.048 | **35.04** |
| 1 NAT gateway *before traffic* | $0.059/hr | 730 × 0.059 | **43.07** |
| Application Load Balancer | $0.0252/hr + $0.008/LCU-hr, illustration at 1 LCU | 730 × (0.0252 + 0.008) | **24.24** |
| Fargate API Linux x86 | 0.5 vCPU @ $0.04856/vCPU-hr + 1 GiB @ $0.00532/GiB-hr | 730 × (0.5×0.04856 + 1×0.00532) | **21.61** |
| Fargate worker Linux x86 | 0.25 vCPU and 0.5 GiB at same unit prices | 730 × (0.25×0.04856 + 0.5×0.00532) | **10.80** |
| **Subtotal of these meters only** | | | **171.99** |

**Unpriced or not yet validated against an AWS account:** RDS gp3 provisioned storage and any burst/scale, extra backup/snapshots, NAT bytes (published $0.059/GB), ALB LCU variance and cross-zone traffic, public IPv4, CloudWatch logs/metrics/alarms, KMS API calls, S3/ECR, Secrets Manager, paid support, DNS/certificates, data egress, any quotas/extra tasks, taxes/GST and regional price changes. At US$300, the nominal difference from this **incomplete** subtotal is US$128.01; it is **not** spare cash or a safe spending allowance.

### Working budget reservation (illustrative, not priced usage)
- Target **no more than US$240/month** of projected recurring baseline including ordinary storage, network and telemetry, preserving about US$60 for variability.
- If the AWS Pricing Calculator/account-aware forecast predicts **over US$240**, redesign or schedule a shorter-lived staging environment before applying. This is an **engineering control objective**, not an external price quote.
- If it predicts **over US$300**, **NO-GO**: do not apply and do not silently raise the threshold.
- AWS Budgets notifications at 50% actual, 80% forecasted, 80% actual and 100% actual provide escalation signals, **not enforcement**. Budgets have reporting delays; design a reviewed manual shutdown/cleanup procedure. The read-only access role must never be able to apply Terraform.

## Authoritative pricing/reference links consulted
- Sydney RDS `db.t4g.small` public-price mirror (daily updated): https://instances.usage.ai/aws/rds/region/ap-southeast-2
- Sydney Redis `cache.t4g.small` public-price mirror: https://instances.usage.ai/aws/elasticache/region/ap-southeast-2
- AWS official example confirming Sydney NAT $0.059/hr and $0.059/GB: https://aws.amazon.com/network-firewall/pricing/
- AWS VPC NAT metering: https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-pricing.html
- Sydney Fargate public-price mirror: https://instances.usage.ai/fargate?region=ap-southeast-2
- Sydney ALB public-price mirror: https://cloud-credits.org/prices/alb/ap-southeast-2
- AWS official AWS Budgets lag, limits and cost alerts: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
- **Required owner-account-specific source before applying:** https://calculator.aws/#/ and the account's current offers/billing dashboard. Do not mistake public mirrors for a binding quote.

## Gates to clear in order
1. Owner confirms AWS account ownership and approved staging account ID, **without revealing credentials in chat**.
2. AWS read-only role via GitHub OIDC, restricted to `repo:BSaumil/NUA-CREW:environment:nua-crew-staging-readonly`; audit the target identity. See `docs/operations/AWS_STAGING_SECURE_ACCESS_2026-11-06.md`.
3. Verify all selected AWS resource SKUs in `ap-southeast-2`, build a calculator estimate including 730h, 20 GiB gp3, logging, two public IPv4 addresses where applicable, 20–100 GiB monthly transfer sensitivity, and backups. Record estimate date/identifier, exact Terraform SHA, account and tax handling in a private approval record.
4. Approve backend S3 state bucket/KMS/locking and its small additional spend; create only with a separate authorised bootstrap.
5. The operator presents a **real** `terraform plan` from AWS read/plan role showing exact resource counts and forecast; review the plan JSON for secrets and file permissions before anyone applies it. No plan has run yet.
6. Only then authorise a scoped, time-bounded **deployment role** and `terraform apply` in a separately approved workflow. First apply remains closed (`enable_services=false` and empty `allowed_https_cidrs`), but **will incur expenses** including NAT, ALB, RDS and Redis. No actual apply until all above gates are evidenced.

## Verification and release state
This document records a cost estimate and staged owner approval only. It does **not** clear the pilot readiness registry, prove API hosting, test AWS billing, or grant permission for production migrations, live Stripe, NZ transactions, unprotected access or public hiring.
