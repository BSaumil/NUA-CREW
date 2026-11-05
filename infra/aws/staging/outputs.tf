output "aws_region" {
  description = "Only Sydney is supported in this staging module"
  value       = var.aws_region
}

output "ecr_repository_url" {
  description = "Push the reviewed, immutable image digest here"
  value       = aws_ecr_repository.api.repository_url
}

output "staging_alb_hostname" {
  description = "Inactive/closed until approved sources, ACM and enable_services are configured"
  value       = aws_lb.api.dns_name
}

output "rds_endpoint" {
  description = "Private RDS endpoint; never put admin credentials into the API"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_master_secret_arn" {
  description = "AWS-managed DB master secret; use only in secure migration/admin workflows"
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  sensitive   = true
}

output "redis_endpoint" {
  description = "Private Redis endpoint; require TLS and approved auth"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "runtime_secret_arn" {
  description = "Fill keys in AWS Secrets Manager before enabling services; no values in Terraform"
  value       = aws_secretsmanager_secret.runtime.arn
}

output "private_document_bucket" {
  description = "Created for later review, but runtime ECS task role has NO S3 grant; uploads OFF"
  value       = aws_s3_bucket.documents.id
}

output "api_service_enabled" {
  value = var.enable_services
}
