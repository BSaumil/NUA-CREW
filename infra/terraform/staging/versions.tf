terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State holds the Redis auth token and other sensitive attributes. Use an encrypted, access-
  # restricted remote backend (for example an S3 bucket with versioning, SSE-KMS and a locking
  # table), supplied at `terraform init -backend-config=...`. It is deliberately not configured
  # here so no account details live in the repository.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "nua-crew"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
