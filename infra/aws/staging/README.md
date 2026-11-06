# NUA CREW AWS Sydney staging

See the [staging infrastructure and activation runbook](../../../docs/operations/AWS_SYDNEY_STAGING_IAC_2026-11-05.md).

## Budget and account connection (6 November 2026)

The product owner approved a **US$300/month spending target**, conditional on real AWS prices, a reviewed deployment plan and secure account access. This is **not** an AWS hard spending cap or permission for a blind apply.

- [Cost envelope and sources](../../../docs/operations/AWS_STAGING_300_USD_COST_ENVELOPE_2026-11-06.md)
- [GitHub OIDC secure read-only account setup](../../../docs/operations/AWS_STAGING_SECURE_ACCESS_2026-11-06.md)
- Reproducible indicative cost-floor check: `python3 scripts/aws_staging_cost_floor.py --check` from repository root.
- Manual read-only GitHub Actions workflow: `aws-staging-readonly-preflight`. It cannot provision anything.
- [Read-only service smoke script](../../../scripts/staging-smoke.sh) — run only against an authorised deployed API URL.

**No AWS resources are provisioned by these files.** Even an initial apply with `enable_services=false` would incur ongoing RDS, Redis, NAT and load-balancer charges. It requires a separately reviewed actual AWS Pricing Calculator estimate, state/role setup and operator approval. Production DB migrations, live billing, public access and NZ transactions remain blocked.
