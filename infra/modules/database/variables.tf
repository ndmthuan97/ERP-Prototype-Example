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
