locals {
  # Everything that must stay OFF in staging is set explicitly, so a missing setting can never fall
  # back to something more permissive. Changing any of these is a reviewed code change.
  app_environment = [
    { name = "NUA_ENV", value = "staging" },
    { name = "NUA_CORS_ORIGINS", value = jsonencode(var.cors_origins) },
    { name = "NUA_DOCUMENT_STORAGE", value = "disabled" },
    { name = "NUA_PUSH_PROVIDER", value = "none" },
    { name = "NUA_STRIPE_MODE", value = "disabled" },
    { name = "NUA_PAID_ADVERTISING_ENABLED", value = "false" },
    { name = "NUA_BILLING_TERMS_APPROVED", value = "false" },
    # The auth rate limiter keys on the client address. Behind the load balancer that is only
    # correct if uvicorn trusts forwarded headers from the VPC range.
    { name = "FORWARDED_ALLOW_IPS", value = var.vpc_cidr },
  ]

  runtime_secrets = [
    { name = "NUA_JWT_SECRET", valueFrom = aws_secretsmanager_secret.owner["jwt_secret"].arn },
    { name = "NUA_DATABASE_URL", valueFrom = aws_secretsmanager_secret.owner["database_url"].arn },
    { name = "NUA_REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
  ]

  migrate_secrets = [
    { name = "NUA_JWT_SECRET", valueFrom = aws_secretsmanager_secret.owner["jwt_secret"].arn },
    { name = "NUA_MIGRATION_DATABASE_URL", valueFrom = aws_secretsmanager_secret.owner["migration_database_url"].arn },
  ]
}

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}/api"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}/worker"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${local.name}/migrate"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.runtime_exec.arn
  task_role_arn            = aws_iam_role.api_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.image_uri
    essential = true

    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    environment  = local.app_environment
    secrets      = local.runtime_secrets

    # Liveness only. /readyz also checks the database; if the load balancer used it, a database
    # outage would make ECS replace healthy tasks and make things worse.
    healthCheck = {
      command     = ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3).status == 200 else 1)\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.runtime_exec.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name        = "worker"
    image       = var.image_uri
    essential   = true
    command     = ["python", "-m", "app.worker", "--poll", "10"]
    stopTimeout = 60 # lets the task in hand finish after SIGTERM
    environment = local.app_environment
    secrets     = local.runtime_secrets

    # No HTTP port, so no HTTP health check. Progress is watched through the "pass complete" log
    # line, turned into a metric and alarm in monitoring.tf.
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

# One-off schema migration. There is no service for it: it is started by hand with `aws ecs run-task`
# (see outputs.tf and the README) after the reviewed preflight, and uses the migrator credential only.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.migrate_exec.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = var.image_uri
    essential = true
    command   = ["alembic", "upgrade", "head"]
    environment = [
      { name = "NUA_ENV", value = "staging" },
    ]
    secrets = local.migrate_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migrate.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds  = 90
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  propagate_tags                     = "SERVICE"
  enable_execute_command             = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
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
  name            = "worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  propagate_tags                     = "SERVICE"
  enable_execute_command             = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }
}
