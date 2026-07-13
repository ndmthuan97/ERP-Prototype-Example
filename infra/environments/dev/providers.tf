# ============================================================
# ERP Prototype — Terraform Infrastructure
# ============================================================
# Region: us-central1 (Iowa) — Tier 1, cheapest
# Cost: ~$15-20/month (covered by $300 free credit)
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Identity Platform (google_identity_platform_config) bills to the consumer
  # project, so the provider must send the X-Goog-User-Project header. Required
  # when authenticating with user ADC (gcloud auth application-default login).
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ============================================================
# Enable required GCP APIs
# ============================================================

locals {
  required_apis = [
    "run.googleapis.com",               # Cloud Run
    "sqladmin.googleapis.com",          # Cloud SQL Admin
    "pubsub.googleapis.com",            # Cloud Pub/Sub
    "secretmanager.googleapis.com",     # Secret Manager
    "artifactregistry.googleapis.com",  # Artifact Registry
    "vpcaccess.googleapis.com",         # VPC Access Connector
    "cloudbuild.googleapis.com",        # Cloud Build
    # clouddeploy.googleapis.com — CỐ Ý không quản ở đây. Đã enable bằng `gcloud
    # deploy apply`. Thêm vào set này làm google_project_service.apis đổi →
    # module.pubsub (depends_on apis) hoãn đọc data.google_project → project.number
    # unknown → replace 6 binding dead-letter IAM vô cớ. Không đáng để track 1 API.
    "compute.googleapis.com",           # Compute Engine (VPC)
    "servicenetworking.googleapis.com", # Private Service Access
    "iam.googleapis.com",               # IAM
    "iamcredentials.googleapis.com",    # IAM Credentials (WIF)
    "orgpolicy.googleapis.com",         # Org Policy (Domain Restricted Sharing override)
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
