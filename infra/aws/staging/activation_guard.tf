# Guard against accidental ECS/ALB activation with incomplete security inputs.
# This verifies *syntax* and explicit host CIDRs, not secrets, cert ownership or API authorisation.
resource "terraform_data" "activation_guard" {
  input = var.enable_services

  lifecycle {
    precondition {
      condition = !var.enable_services || (
        length(var.allowed_https_cidrs) > 0
        && can(regex("@sha256:[0-9a-f]{64}$", var.image_uri))
        && can(regex("^arn:aws:acm:ap-southeast-2:[0-9]{12}:certificate/", var.acm_certificate_arn))
      )
      error_message = "ECS staging activation requires approved non-world-open ingress CIDRs, immutable image digest and a Sydney ACM TLS certificate."
    }
  }
}
