# One-time, owner-run bootstrap for Terraform remote state and a plan-only role.
# NOT applied by CI and NOT applied by any agent. Uses LOCAL state on purpose: it creates the
# bucket that infra/aws/staging will store its state in. The local state file for this module
# contains no secrets (no passwords or tokens are inputs here) but should still be kept private.
terraform {
  required_version = ">= 1.11.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.75, < 7.0"
    }
  }
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.expected_aws_account_id]

  default_tags {
    tags = {
      Application = "nua-crew"
      Environment = "staging"
      ManagedBy   = "terraform"
      Owner       = "nua-crew"
      Component   = "state-bootstrap"
    }
  }
}
