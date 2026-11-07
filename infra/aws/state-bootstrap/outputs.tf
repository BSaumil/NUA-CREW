output "state_bucket" {
  description = "S3 bucket that will hold the staging stack's Terraform state."
  value       = aws_s3_bucket.state.bucket
}

output "state_kms_key_arn" {
  description = "KMS key that encrypts the state."
  value       = aws_kms_key.state.arn
}

output "plan_role_arn" {
  description = "Set as the AWS_STAGING_PLAN_ROLE_ARN variable of the protected plan environment."
  value       = aws_iam_role.plan.arn
}

output "staging_backend_config" {
  description = "Non-secret values to pass to `terraform init` in infra/aws/staging (-backend-config)."
  value = {
    bucket     = aws_s3_bucket.state.bucket
    key        = var.state_key
    region     = var.aws_region
    kms_key_id = aws_kms_key.state.arn
  }
}
