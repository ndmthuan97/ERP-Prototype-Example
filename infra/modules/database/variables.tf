variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "db_tier" {
  type        = string
  default     = "db-f1-micro"
  description = "Cloud SQL machine type"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Database user password"
}

variable "vpc_network" {
  type        = string
  description = "VPC network ID for private IP"
}

variable "enable_public_ip" {
  type        = bool
  default     = false
  description = <<-EOT
    Allocate a public IPv4 on the instance (in ADDITION to the private IP).
    Default false = private-only. Set true so the Cloud SQL Auth Proxy can be
    run from a local machine that is not on the VPC (dev convenience).

    Enabling this alone does NOT expose the DB: authorized_networks is left
    empty, so no host can connect directly by IP — only the Auth Proxy, which
    authenticates via IAM + TLS. Never add 0.0.0.0/0 to authorized_networks.
  EOT
}
