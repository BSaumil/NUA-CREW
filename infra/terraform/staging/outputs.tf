output "api_url_host" {
  description = "Load balancer DNS name. Point the approved API hostname at it (DNS is a separate, approved step)."
  value       = aws_lb.api.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "owner_supplied_secret_arns" {
  description = "Secrets the owner must fill in AWS Secrets Manager before tasks can start."
  value       = { for k, s in aws_secretsmanager_secret.owner : k => s.arn }
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "database_master_secret_arn" {
  description = "RDS-managed master credential. For the one-off role bootstrap only."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "migrate_run_task_parameters" {
  description = "Inputs for the one-off `aws ecs run-task` that applies migrations (see the README)."
  value = {
    cluster         = aws_ecs_cluster.main.name
    task_definition = aws_ecs_task_definition.migrate.family
    subnets         = aws_subnet.private[*].id
    security_group  = aws_security_group.worker.id
  }
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
