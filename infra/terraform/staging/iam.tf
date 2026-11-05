data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# ---- execution roles: pull the image and read only the secrets that task needs ----
resource "aws_iam_role" "runtime_exec" {
  name               = "${local.name}-runtime-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "runtime_exec_managed" {
  role       = aws_iam_role.runtime_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "runtime_exec" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.owner["jwt_secret"].arn,
      aws_secretsmanager_secret.owner["database_url"].arn,
      aws_secretsmanager_secret.redis_url.arn,
    ]
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "runtime_exec" {
  role   = aws_iam_role.runtime_exec.id
  policy = data.aws_iam_policy_document.runtime_exec.json
}

# The migration task is the only one that can read the migration DSN. It also needs the JWT secret
# because the application refuses to load its settings outside development without one.
resource "aws_iam_role" "migrate_exec" {
  name               = "${local.name}-migrate-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "migrate_exec_managed" {
  role       = aws_iam_role.migrate_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "migrate_exec" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.owner["migration_database_url"].arn,
      aws_secretsmanager_secret.owner["jwt_secret"].arn,
    ]
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "migrate_exec" {
  role   = aws_iam_role.migrate_exec.id
  policy = data.aws_iam_policy_document.migrate_exec.json
}

# ---- task roles: what the running application may do in AWS. Nothing, until documents are enabled ----
resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role" "worker_task" {
  name               = "${local.name}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "api_documents" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.documents.arn}/documents/*"]
  }

  statement {
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.main.arn]
  }
}

data "aws_iam_policy_document" "worker_documents" {
  statement {
    actions   = ["s3:DeleteObject", "s3:DeleteObjectVersion"]
    resources = ["${aws_s3_bucket.documents.arn}/documents/*"]
  }

  statement {
    actions   = ["s3:ListBucketVersions"]
    resources = [aws_s3_bucket.documents.arn]
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "api_documents" {
  count  = var.enable_document_access ? 1 : 0
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_documents.json
}

resource "aws_iam_role_policy" "worker_documents" {
  count  = var.enable_document_access ? 1 : 0
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_documents.json
}
