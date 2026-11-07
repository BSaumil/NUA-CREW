# NUA CREW staging: Terraform state bootstrap and plan-only role

**Nothing here has been applied.** No AWS account is connected, no plan has been run, and no
resource exists. This module is code only. See the
[owner checklist and cost notes](../../../docs/operations/AWS_STAGING_IAC_PREP_2026-11-07.md).

It creates, once, in the owner-approved Sydney account:

| Resource                      | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| KMS key + alias (rotation on) | Encrypts Terraform state, which holds the Redis auth token.                   |
| S3 state bucket               | Versioned, KMS-encrypted, public access blocked, TLS only, `prevent_destroy`. |
| IAM role `<project>-tf-plan`  | **Plan-only** role for GitHub Actions OIDC.                                   |

The plan role can read the state, write only the state _lock object_, and read (not change) what
`infra/aws/staging` manages. It cannot read secret values or pull images, and it has no create,
update or delete permission on any staging resource. Its trust policy accepts exactly
`repo:<repository>:environment:<plan environment>`: one repository, one protected environment, no
wildcards. The GitHub OIDC identity provider is **looked up, never created**; the owner manages it.

## Deliberately not here

- **A deploy / apply role.** The first cost-bearing apply needs its own independent, time-bounded
  and human-approved role and authorisation (issue #40). It is not part of this module.
- ClamAV, the database role bootstrap / migration task, WAF and flow logs (issue #41).

## Use (owner, after the gates in issue #40 are met)

Run only from a trusted machine with credentials for the approved account, never from a pull
request:

```bash
cp terraform.tfvars.example ../../../../private/state-bootstrap.tfvars   # edit; keep outside git
terraform init
terraform plan  -var-file=../../../../private/state-bootstrap.tfvars -out=state-bootstrap.tfplan
terraform apply state-bootstrap.tfplan   # only after the plan has been reviewed
```

This module uses **local state** (it creates the bucket the staging stack will use). Keep that
file private; it contains no secrets, but it is the only record of these resources.

Then initialise `infra/aws/staging` with the `staging_backend_config` output:

```bash
terraform init -backend-config="bucket=<state_bucket>" -backend-config="key=staging/terraform.tfstate" \
  -backend-config="region=ap-southeast-2" -backend-config="kms_key_id=<state_kms_key_arn>"
```

Format and validity are checked in CI by `aws-staging-terraform-validate` with **no credentials**.
