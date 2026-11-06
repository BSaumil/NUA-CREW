#!/usr/bin/env python3
"""NUA Crew staging indicative Sydney public-rate cost floor, not a cloud quote.

Checked 2026-11-06. Rates are illustrative USD public on-demand prices from
sources documented in docs/operations/AWS_STAGING_300_USD_COST_ENVELOPE_2026-11-06.md.
No AWS credentials or changes. Never treat a passing result as apply approval.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
from pathlib import Path

HOURS = Decimal("730")
BUDGET = Decimal("300")
RATES = {
    "rds_small_hour": Decimal("0.051"),
    "redis_small_hour": Decimal("0.048"),
    "nat_hour": Decimal("0.059"),
    "alb_hour": Decimal("0.0252"),
    "alb_lcu_hour": Decimal("0.008"),
    "fargate_cpu_hour": Decimal("0.04856"),
    "fargate_memory_hour": Decimal("0.00532"),
}


def read_config(root: Path) -> tuple[str, str]:
    variables = (root / "infra/aws/staging/variables.tf").read_text()
    services = (root / "infra/aws/staging/services.tf").read_text()
    data = (root / "infra/aws/staging/data.tf").read_text()
    versions = (root / "infra/aws/staging/versions.tf").read_text()

    # Fail closed on resource-family or task-size changes. Refresh price estimates
    # and these assertions together before changing the staging architecture.
    required = {
        "db.t4g.small": 'default = "db.t4g.small"',
        "cache.t4g.small": 'default = "cache.t4g.small"',
        "API 0.5vCPU / 1GiB": 'cpu                      = "512"',
        "worker 0.25vCPU": 'cpu                      = "256"',
        "worker 0.5GiB": 'memory                   = "512"',
        "API 1GiB": 'memory                   = "1024"',
    }
    for label, token in required.items():
        if token not in variables + services:
            raise ValueError(f"Staging assumptions changed ({label}); refresh quote first")
    if "allowed_account_ids = [var.expected_aws_account_id]" not in versions:
        raise ValueError("AWS provider must reject the wrong account before plan/apply")
    if 'max_allocated_storage           = 40' not in data:
        raise ValueError("RDS storage cap changed: requires new cost review")
    if 'var.monthly_budget_usd >= 20 && var.monthly_budget_usd <= 300' not in variables:
        raise ValueError("Owner-approved budget guard must remain at or below US$300")
    return variables, services


def subtotal() -> dict[str, Decimal]:
    fargate_api = (Decimal("0.5") * RATES["fargate_cpu_hour"]
                   + RATES["fargate_memory_hour"]) * HOURS
    fargate_worker = (Decimal("0.25") * RATES["fargate_cpu_hour"]
                      + Decimal("0.5") * RATES["fargate_memory_hour"]) * HOURS
    return {
        "RDS db.t4g.small (instance only)": RATES["rds_small_hour"] * HOURS,
        "Redis cache.t4g.small (node only)": RATES["redis_small_hour"] * HOURS,
        "NAT gateway (hours only)": RATES["nat_hour"] * HOURS,
        "ALB (1 LCU assumption)": (RATES["alb_hour"] + RATES["alb_lcu_hour"]) * HOURS,
        "Fargate API": fargate_api,
        "Fargate worker": fargate_worker,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--check", action="store_true", help="Assert model assumptions and budget floor")
    args = p.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.check:
        read_config(root)
    prices = subtotal()
    for name, amount in prices.items():
        print(f"{name}: US${amount:.2f}")
    total = sum(prices.values(), Decimal("0"))
    print(f"Public-rate CORE ONLY subtotal: US${total:.2f} of US${BUDGET} target")
    print("EXCLUDES storage, network bytes, public IPv4, logs, KMS, backups, data egress, taxes.")
    print("GO for further cost review only. This is NOT a live AWS account quote or apply approval.")
    if args.check and total >= BUDGET:
        raise ValueError("Core meters alone exceed US$300; redesign before any plan/apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
