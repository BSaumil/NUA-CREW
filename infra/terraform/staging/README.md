# NUA CREW staging infrastructure (plan only)

Terraform for an isolated `nua-crew-staging` environment in AWS Sydney (`ap-southeast-2`). **Nothing here has been applied, and applying it is not authorised.** It needs an owner-confirmed AWS account, a budget, approved hostnames and secrets entered directly in AWS. See `docs/operations/STAGING_INFRA_DESIGN_2026-11-05.md` for the design, security properties, accepted scan findings, cost drivers and open items.

## Check it without credentials

```bash
cd infra/terraform/staging
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

CI runs the same three steps (`.github/workflows/terraform-validate.yml`). A real `terraform plan` needs AWS credentials and has **not** been run.

## Files

| File                                               | Contents                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `versions.tf`, `variables.tf`, `outputs.tf`        | Providers, validated inputs, outputs                                      |
| `network.tf`                                       | VPC, subnets, NAT, S3 endpoint, security groups, flow logs                |
| `kms.tf`, `secrets.tf`, `iam.tf`                   | Key, secret containers, execution and task roles                          |
| `rds.tf`, `redis.tf`, `s3.tf`, `logs.tf`, `ecr.tf` | PostgreSQL 16, Redis, documents bucket, access-log bucket, image registry |
| `ecs.tf`, `alb.tf`                                 | API and worker services, one-off migration task, load balancer            |
| `monitoring.tf`                                    | Alarms, alert topic, monthly budget                                       |

## Inputs

Copy `terraform.tfvars.example` to `terraform.tfvars` (git-ignored). The image must be pinned by digest, origins must be exact HTTPS origins, at least one alert address and a monthly budget are required. These rules are enforced by variable validation.
