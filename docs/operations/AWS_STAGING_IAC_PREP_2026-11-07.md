# AWS staging: code-only preparation and owner checklist

**7 November 2026. Nothing in this document or its pull request touches AWS.** No account is
connected, no Terraform plan or apply has run, and no resource exists or is billed. This is the
code and the checklist that make the first reviewed step quick once the owner gates in issue #40
are met. It does not authorise any of them.

## What is now in the repository

`infra/aws/state-bootstrap/` (new, separate from `infra/aws/staging/`, validated in CI with no
credentials):

| Piece | What it is | Why |
| --- | --- | --- |
| KMS key + alias | Customer-managed, rotation on | Terraform state holds the Redis auth token; encrypting it under a key whose use IAM controls is the runbook's requirement. |
| State bucket | Versioned, KMS-encrypted, public access blocked, TLS only, `prevent_destroy`, 90-day rollback window | Remote, encrypted, access-controlled, locked state (`use_lockfile = true` in the staging backend). |
| `nua-crew-staging-tf-plan` role | **Read-only** plan role, GitHub OIDC | Lets a reviewed plan run without any stored key. Trust is one repository plus one protected environment, no wildcards. Reads state; writes only the lock object; cannot read secret values or pull images; no write permission on any staging resource. |

CI (`aws-staging-terraform-validate`) now also runs format, `init -backend=false` and `validate` on
this module, and fails if the plan role's trust gets a wildcard or its policy gains a write action
(a coarse text guard; the review of the IAM policy is still the real control).

**Checked here:** `terraform fmt` and `terraform validate` passed locally on Terraform 1.11.4 with
AWS provider 6.72.0 and no AWS credentials in the process. **Not checked, because nothing was
applied:** that the role's read permissions are *sufficient* for a full plan of `infra/aws/staging`.
Expect to widen them once, by reviewed change, after the first read-only plan reports a missing
permission.

## Cost of what was added
Small, and only if and when it is applied: one customer-managed KMS key (AWS list price is about
US$1 per key per month plus request charges, confirm in the Pricing Calculator for the owner's
account) and a small versioned S3 bucket (cents per month at this size). None of it changes the
`infra/aws/staging` estimate, which remains the dominant cost (about US$172/month of core meters
before usage charges, per the cost envelope). The US$300 limit and the no-go above it are unchanged.

## Owner checklist, in order
Each step is yours; none can be done from the repository.

1. **Default branch.** Change GitHub's default branch from the stale `claude/new-session-kszaxl`
   to `main` (check Vercel and branch protection first). Manual workflows only run from the default
   branch.
2. **Account.** Pick the dedicated staging account and payer; confirm it has no unexpected
   chargeable resources. Do not share credentials in chat or the repository.
3. **OIDC provider and read-only preflight role.** Follow
   [the secure access runbook](AWS_STAGING_SECURE_ACCESS_2026-11-06.md) steps 2 to 6, then run
   `aws-staging-readonly-preflight` once on `main`.
4. **Get the account-specific quote** (Pricing Calculator) for the whole stack including NAT data,
   IPv4, RDS storage and backups, ALB LCU, Fargate, CloudWatch, Secrets Manager, S3 and tax.
   Target at most US$240 steady; **no-go above US$300**.
5. **Apply the state bootstrap yourself**, from a trusted machine, with the plan reviewed first
   (commands in `infra/aws/state-bootstrap/README.md`). This is the first cost-bearing apply and
   needs your separate, explicit go-ahead; I will not run it.
6. **Create the protected `nua-crew-staging-plan` environment** and set the
   `AWS_STAGING_PLAN_ROLE_ARN` variable from the module's output.
7. Only then: a reviewed `terraform plan` of `infra/aws/staging` through that role, and a decision
   on the deploy role and the first apply of the staging stack.

## Not built yet, with the open decision for each (issue #41)
- **Plan workflow.** A manual workflow that assumes the plan role and runs `terraform plan`. It
  needs steps 1 to 6 to exist before it can be written against reality; it must never run on a pull
  request from a branch.
- **Deploy / apply role.** Separate, time-bounded, human-approved, exact commit, estimate and
  account confirmation. Deliberately absent so nothing here can create resources.
- **Database role bootstrap and migrations.** `db/roles/bootstrap.sql` uses `psql` meta-commands, so
  a one-off task needs a pinned `psql` client image (by digest) or a different mechanism, plus a
  separate migrator secret so the running API only ever holds the DML-only `nua_runtime` role.
  Decision needed: which client image/mechanism. Needs a backup and restore rehearsal before use.
- **ClamAV / document scanning.** Document storage stays disabled. The signature database needs a
  few gigabytes of memory, which sizes (and prices) the task; measure before quoting. Needs a
  scan-before-available design and S3 least-privilege tests first.
- **Flow logs, ALB access logs, WAF, extra alarms.** Each needs its own cost and privacy review;
  none is added by default.

## Unchanged hard limits
No AWS apply, DNS, public launch, production database migration, live Stripe or NZ transactions.
Staging stays closed (no `0.0.0.0/0`) until authentication and exact ingress ranges are verified.
