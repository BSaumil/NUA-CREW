terraform {
  # Enforce remote, encrypted, access-controlled state when applying. Configure an
  # owner-managed S3 backend at terraform init; CI validates with -backend=false.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }

  required_version = ">= 1.11.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.75, < 7.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "nua-crew"
      Environment = "staging"
      ManagedBy   = "terraform"
      Owner       = "nua-crew"
    }
  }
}
