variable "aws_region" {
  description = "AWS region. Sydney keeps data in Australia."
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Environment name, used as a prefix for resources."
  type        = string
  default     = "nua-crew-staging"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.environment))
    error_message = "Use 3 to 31 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "image_uri" {
  description = "API and worker image, pinned by digest (repo@sha256:...), never a mutable tag."
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.image_uri))
    error_message = "Pin the image by digest, for example <account>.dkr.ecr.<region>.amazonaws.com/nua-crew-api@sha256:<64 hex>."
  }
}

variable "acm_certificate_arn" {
  description = "ACM certificate (in this region) for the API hostname. Created and validated by the owner."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:", var.acm_certificate_arn))
    error_message = "Provide an ACM certificate ARN."
  }
}

variable "alb_ingress_cidrs" {
  description = "CIDR blocks allowed to reach the load balancer on 80/443. Empty means closed. Vercel serverless egress is not a fixed range, so the API's own authentication is the control for browser traffic; tighten this when a fixed egress path exists."
  type        = list(string)
  default     = []
}

variable "cors_origins" {
  description = "Exact HTTPS origins allowed by the API (NUA_CORS_ORIGINS). No wildcards."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for o in var.cors_origins : can(regex("^https://[^*/]+$", o))])
    error_message = "Each origin must be an exact https:// origin with no wildcard and no path."
  }
}

variable "alert_emails" {
  description = "Email addresses for alarm and budget notifications."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Provide at least one address so alarms and budget alerts reach a person."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget for this environment, in USD. Set by the owner; there is no default on purpose."
  type        = number

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "Set a positive budget."
  }
}

variable "vpc_cidr" {
  description = "VPC range. Also the range whose forwarded client-address headers the API trusts."
  type        = string
  default     = "10.40.0.0/16"
}

variable "nat_gateway_count" {
  description = "1 is cheaper and acceptable for staging; 2 gives one per availability zone."
  type        = number
  default     = 1

  validation {
    condition     = contains([1, 2], var.nat_gateway_count)
    error_message = "Use 1 or 2."
  }
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "db_instance_class" {
  description = "Starting size only. Review after the first load test."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage_gb" {
  type    = number
  default = 100
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "documents_noncurrent_version_days" {
  description = "How long superseded or deleted document versions are kept. This is the permanent-erasure window and needs a privacy decision before uploads are ever enabled."
  type        = number
  default     = 30
}

variable "enable_document_access" {
  description = "Grants the API and worker roles access to the documents bucket. Keep false until private storage and a malware scanner are accepted; uploads are also disabled in the application."
  type        = bool
  default     = false
}

variable "alb_deletion_protection" {
  description = "Protects the load balancer from accidental deletion. Set false only to tear the environment down."
  type        = bool
  default     = true
}

variable "access_log_retention_days" {
  description = "How long load balancer and storage access logs are kept."
  type        = number
  default     = 90
}
