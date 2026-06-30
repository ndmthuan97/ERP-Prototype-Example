variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "database_url" {
  type        = string
  sensitive   = true
  description = "PostgreSQL connection URL"
}

variable "database_direct_url" {
  type        = string
  sensitive   = true
  description = "PostgreSQL direct URL (for Prisma migrate)"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT signing secret"
}

variable "upstash_redis_url" {
  type        = string
  sensitive   = true
  description = "Upstash Redis REST API URL"
}

variable "upstash_redis_token" {
  type        = string
  sensitive   = true
  description = "Upstash Redis REST API token"
}
