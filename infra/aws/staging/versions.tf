terraform {
  required_version = ">= 1.7.0"

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
