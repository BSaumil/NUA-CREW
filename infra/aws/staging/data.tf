resource "aws_db_subnet_group" "private" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                     = "${var.project_name}-postgres"
  engine                         = "postgres"
  engine_version                 = "16"
  instance_class                 = var.db_instance_class
  allocated_storage              = 20
  max_allocated_storage          = 100
  storage_type                   = "gp3"
  storage_encrypted              = true
  db_name                        = "nua_crew_staging"
  username                       = "nua_admin"
  manage_master_user_password    = true
  publicly_accessible           = false
  multi_az                       = false
  deletion_protection            = true
  backup_retention_period        = 7
  auto_minor_version_upgrade     = true
  db_subnet_group_name           = aws_db_subnet_group.private.name
  vpc_security_group_ids         = [aws_security_group.db.id]
  apply_immediately              = false
  skip_final_snapshot            = false
  final_snapshot_identifier      = "${var.project_name}-final-snapshot"
  copy_tags_to_snapshot          = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_elasticache_subnet_group" "private" {
  name       = "${var.project_name}-cache-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis"
  description                = "Isolated NUA CREW staging Redis; no public endpoint"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 1
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = false
  multi_az_enabled           = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.private.name
  security_group_ids         = [aws_security_group.redis.id]
  snapshot_retention_limit   = 1
  apply_immediately          = false
}

resource "aws_s3_bucket" "documents" {
  bucket        = "${var.project_name}-docs-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

data "aws_iam_policy_document" "bucket_tls" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.documents.arn,
      "${aws_s3_bucket.documents.arn}/*"
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = data.aws_iam_policy_document.bucket_tls.json
}

resource "aws_budgets_budget" "staging" {
  name         = "${var.project_name}-monthly-cost-alert"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
