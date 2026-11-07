variable "aws_region" {
  description = "All NUA CREW staging infrastructure is restricted to AWS Sydney."
  type        = string
  default     = "ap-southeast-2"
  validation {
    condition     = var.aws_region == "ap-southeast-2"
    error_message = "NUA CREW staging must remain in AWS Sydney (ap-southeast-2)."
  }
}

# Required for every plan/apply. A wrong account must be rejected by the provider.
variable "expected_aws_account_id" {
  description = "Approved AWS staging account ID, supplied securely by the owner, never inferred from caller credentials."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.expected_aws_account_id))
    error_message = "The approved staging account ID must be exactly 12 digits."
  }
}

variable "project_name" {
  description = "Must match infra/aws/staging project_name so the read-only role can see its resources."
  type        = string
  default     = "nua-crew-staging"
}

variable "github_repository" {
  description = "GitHub repository (owner/name) allowed to assume the plan-only role."
  type        = string
  default     = "BSaumil/NUA-CREW"
  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$", var.github_repository))
    error_message = "Use exactly owner/name with no wildcards."
  }
}

variable "plan_environment_name" {
  description = "Protected GitHub Actions environment whose OIDC subject may assume the plan-only role. Never a wildcard."
  type        = string
  default     = "nua-crew-staging-plan"
  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+$", var.plan_environment_name))
    error_message = "Use one exact environment name with no wildcards."
  }
}

variable "state_key" {
  description = "Object key of the staging stack's state in the bucket (its lock file is this key plus .tflock)."
  type        = string
  default     = "staging/terraform.tfstate"
}

variable "noncurrent_state_retention_days" {
  description = "Days to keep superseded state versions (rollback window). Bounded to limit storage cost."
  type        = number
  default     = 90
  validation {
    condition     = var.noncurrent_state_retention_days >= 30 && var.noncurrent_state_retention_days <= 365
    error_message = "Keep between 30 and 365 days of previous state versions."
  }
}
