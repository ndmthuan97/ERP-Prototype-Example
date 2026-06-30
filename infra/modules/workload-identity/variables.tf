variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository in format 'owner/repo'"
}

variable "deployer_sa_id" {
  type        = string
  description = "Deployer service account ID (for WIF binding)"
}
