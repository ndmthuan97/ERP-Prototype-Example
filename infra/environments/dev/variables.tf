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

# --- Identity Platform / Google sign-in (migration B1) ---

variable "auth_authorized_domains" {
  type        = list(string)
  default     = ["localhost"]
  description = "Domains allowed to complete Google sign-in via Identity Platform. Add the Cloud Run frontend domain alongside localhost when deployed."
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 Web client ID for Google sign-in (manually created in the Console — see terraform.tfvars.example)"
}

variable "google_oauth_client_secret" {
  type        = string
  sensitive   = true
  description = "OAuth 2.0 Web client secret for Google sign-in (manually created in the Console)"
}

# --- GitHub (for Workload Identity Federation) ---

variable "github_repo" {
  type        = string
  description = "GitHub repository in format 'owner/repo'"
}

# --- Cloud Run service IAM (post Cloud Deploy handoff) ---

variable "enable_service_iam" {
  type        = bool
  default     = true
  description = <<-EOT
    Tạo IAM binding (allUsers invoker + gateway→backend invoker) cho các Cloud Run
    service do Cloud Deploy sở hữu. Cần service TỒN TẠI lúc apply.
    - true  (mặc định): dùng khi service đã chạy (bàn giao) hoặc sau release đầu.
    - false: bootstrap từ số 0 — apply nền tảng trước, chạy 1 release để tạo
             service, rồi đặt lại true và apply.
  EOT
}
