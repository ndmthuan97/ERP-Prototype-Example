# ============================================================
# Input Variables
# ============================================================

variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP region (us-central1 = Tier 1, cheapest)"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment name"
}

# --- Database ---

variable "db_tier" {
  type        = string
  default     = "db-f1-micro"
  description = "Cloud SQL machine type"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Cloud SQL erp_app user password"
}

# --- Auth ---

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT signing secret for Auth Service"
}

# --- Upstash Redis (external, FREE) ---

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

# --- GitHub (for Workload Identity Federation) ---

variable "github_repo" {
  type        = string
  description = "GitHub repository in format 'owner/repo'"
}
