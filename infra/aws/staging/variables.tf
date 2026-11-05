variable "aws_region" {
  description = "All staging infrastructure is restricted to AWS Sydney."
  type        = string
  default     = "ap-southeast-2"
  validation {
    condition     = var.aws_region == "ap-southeast-2"
    error_message = "NUA CREW staging must remain in AWS Sydney (ap-southeast-2)."
  }
}

variable "project_name" {
  type        = string
  description = "Stable resource prefix; changing requires a new reviewed state."
  default     = "nua-crew-staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.76.0.0/16"
}

variable "allowed_https_cidrs" {
  description = "Explicit IP ranges allowed to reach the staging API HTTPS load balancer; empty means CLOSED."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "Approved Sydney ACM certificate for staging API hostname; needed only when enable_services is true."
  type        = string
  default     = ""
}

variable "image_uri" {
  description = "Immutable reviewed API/worker ECR image URI using @sha256: digest (not a mutable tag)."
  type        = string
  default     = ""
}

variable "enable_services" {
  description = "False by default. Do not start API/worker or HTTPS listener until image, secrets, certificate and access control are approved."
  type        = bool
  default     = false
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "redis_auth_token" {
  description = "Staging Redis ACL token. Sensitive, but Terraform still stores this in STATE: use an encrypted, access-controlled remote backend."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.redis_auth_token) >= 16 && length(var.redis_auth_token) <= 128
    error_message = "Redis auth token must contain 16 to 128 characters."
  }
}

variable "budget_alert_email" {
  description = "Validated inbox for AWS Cost Budgets alerts; never a founder's personal details in public source."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Staging cost alert threshold (USD); alerts are NOT hard spending limits."
  type        = number
  default     = 300
  validation {
    condition     = var.monthly_budget_usd >= 20
    error_message = "Provide a meaningful positive staging budget in USD."
  }
}
