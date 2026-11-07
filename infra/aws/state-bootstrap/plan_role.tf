# Plan-only role for GitHub Actions (OIDC). It can READ what Terraform manages and READ the state;
# it can write ONLY the state lock object. It has no create/update/delete permission on any
# staging resource and cannot read secret values. It is NOT a deploy role: the first cost-bearing
# apply needs a separately reviewed, time-bounded deploy role that this module deliberately omits.

# The GitHub OIDC identity provider is owner-managed (see the secure access runbook, step 2) and
# is only looked up here, never created, so this module cannot duplicate or alter it.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "plan_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Exact subject only: this repository AND this protected environment. No wildcards.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:${var.plan_environment_name}"]
    }
  }
}

resource "aws_iam_role" "plan" {
  name                 = "${var.project_name}-tf-plan"
  description          = "Read-only Terraform plan role for NUA CREW staging (GitHub OIDC)."
  assume_role_policy   = data.aws_iam_policy_document.plan_trust.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "plan" {
  # --- State: read the state, and write only the lock object (use_lockfile = true) ---
  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation", "s3:GetBucketVersioning"]
    resources = [aws_s3_bucket.state.arn]
  }
  statement {
    sid       = "ReadState"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.state.arn}/${var.state_key}"]
  }
  statement {
    sid       = "UseStateLockOnly"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/${var.state_key}.tflock"]
  }
  statement {
    sid       = "UseStateKey"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
    resources = [aws_kms_key.state.arn]
  }

  # --- Read-only refresh of the resources infra/aws/staging manages (no secret values) ---
  statement {
    sid = "ReadStagingResources"
    actions = [
      "ec2:Describe*",
      "rds:Describe*",
      "rds:ListTagsForResource",
      "elasticache:Describe*",
      "elasticache:ListTagsForResource",
      "ecs:Describe*",
      "ecs:List*",
      "elasticloadbalancing:Describe*",
      "logs:Describe*",
      "logs:ListTagsForResource",
      "logs:ListTagsLogGroup",
      "ecr:DescribeRepositories",
      "ecr:GetLifecyclePolicy",
      "ecr:GetRepositoryPolicy",
      "ecr:ListTagsForResource",
      "iam:Get*",
      "iam:List*",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:ListSecrets",
      "budgets:ViewBudget",
      "acm:DescribeCertificate",
      "acm:ListTagsForCertificate",
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListAliases",
      "kms:ListResourceTags",
    ]
    resources = ["*"]
  }
  statement {
    sid = "ReadStagingBucketConfiguration"
    actions = [
      "s3:GetBucketAcl",
      "s3:GetBucketCORS",
      "s3:GetBucketLogging",
      "s3:GetBucketOwnershipControls",
      "s3:GetBucketPolicy",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketTagging",
      "s3:GetBucketVersioning",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetAccelerateConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:GetBucketRequestPayment",
      "s3:GetBucketWebsite",
      "s3:GetBucketObjectLockConfiguration",
      "s3:ListBucket",
    ]
    resources = ["arn:${local.partition}:s3:::${var.project_name}-*"]
  }

  # --- Belt and braces: never allow reading secret values or pulling images ---
  statement {
    sid    = "DenySecretValuesAndImagePulls"
    effect = "Deny"
    actions = [
      "secretsmanager:GetSecretValue",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
      "ecr:GetAuthorizationToken",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "plan" {
  name   = "terraform-plan-readonly"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan.json
}
