resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecs_cluster" "staging" {
  name = var.project_name
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}/api"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project_name}/worker"
  retention_in_days = 14
}

# Terraform creates the secret container only. Never write credentials or a
# secret VERSION via IaC; the operator must populate JSON keys in AWS console
# or a restricted secret-management workflow, before enable_services=true.
resource "aws_secretsmanager_secret" "runtime" {
  name                    = "${var.project_name}/application"
  recovery_window_in_days = 30
  description             = "Non-development NUA CREW runtime credentials and exact CORS origins"
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.project_name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "ReadOnlyExactAppSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.runtime.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${var.project_name}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Neither the API nor worker can read S3 documents until a separate reviewed
# scanner/storage capability and least-privilege task policy are approved.
resource "aws_iam_role" "task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_lb" "api" {
  name                       = "${var.project_name}-api"
  internal                   = false
  load_balancer_type         = "application"
  subnets                    = aws_subnet.public[*].id
  security_groups            = [aws_security_group.alb.id]
  enable_deletion_protection = true
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "api" {
  name                 = "${var.project_name}-api"
  port                 = 8000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.staging.id
  deregistration_delay = 30

  health_check {
    path                = "/healthz"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 20
    timeout             = 5
  }
}

# NO listener is created until enable_services=true. Also, default ALB
# security-group ingress is empty, so a created ALB is closed to the Internet.
resource "aws_lb_listener" "https" {
  count             = var.enable_services ? 1 : 0
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

locals {
  service_secrets = [
    {
      name      = "NUA_DATABASE_URL"
      valueFrom = "${aws_secretsmanager_secret.runtime.arn}:NUA_DATABASE_URL::"
    },
    {
      name      = "NUA_REDIS_URL"
      valueFrom = "${aws_secretsmanager_secret.runtime.arn}:NUA_REDIS_URL::"
    },
    {
      name      = "NUA_JWT_SECRET"
      valueFrom = "${aws_secretsmanager_secret.runtime.arn}:NUA_JWT_SECRET::"
    },
    {
      name      = "NUA_CORS_ORIGINS"
      valueFrom = "${aws_secretsmanager_secret.runtime.arn}:NUA_CORS_ORIGINS::"
    }
  ]

  disabled_runtime_flags = [
    { name = "NUA_ENV", value = "staging" },
    { name = "NUA_REQUIRE_RLS_SAFE_ROLE", value = "true" },
    { name = "NUA_DOCUMENT_STORAGE", value = "disabled" },
    { name = "NUA_PUSH_PROVIDER", value = "none" },
    { name = "NUA_STRIPE_MODE", value = "disabled" },
    { name = "NUA_PAID_ADVERTISING_ENABLED", value = "false" },
    { name = "NUA_BILLING_TERMS_APPROVED", value = "false" },
    # Uvicorn trusts X-Forwarded-For only from the ALB public subnet CIDRs.
    # ECS task ingress is further restricted to the ALB security group; never use "*".
    # A staged spoofing/unique-client rate-limit test is required before API exposure.
    { name = "FORWARDED_ALLOW_IPS", value = join(",", aws_subnet.public[*].cidr_block) }
  ]
}

resource "aws_ecs_task_definition" "api" {
  count                    = var.enable_services ? 1 : 0
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.image_uri
      essential = true
      user      = "10001"
      portMappings = [
        { containerPort = 8000, hostPort = 8000, protocol = "tcp" }
      ]
      environment = local.disabled_runtime_flags
      secrets     = local.service_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "worker" {
  count                    = var.enable_services ? 1 : 0
  family                   = "${var.project_name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name        = "worker"
      image       = var.image_uri
      essential   = true
      user        = "10001"
      command     = ["python", "-m", "app.worker", "--poll", "10"]
      environment = local.disabled_runtime_flags
      secrets     = local.service_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  count                              = var.enable_services ? 1 : 0
  name                               = "${var.project_name}-api"
  cluster                            = aws_ecs_cluster.staging.id
  task_definition                    = aws_ecs_task_definition.api[0].arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 90
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = false

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }
  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "worker" {
  count                  = var.enable_services ? 1 : 0
  name                   = "${var.project_name}-worker"
  cluster                = aws_ecs_cluster.staging.id
  task_definition        = aws_ecs_task_definition.worker[0].arn
  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = false

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }
}
