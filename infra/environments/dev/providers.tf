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
    "run.googleapis.com",                  # Cloud Run
    "sqladmin.googleapis.com",             # Cloud SQL Admin
    "pubsub.googleapis.com",               # Cloud Pub/Sub
    "secretmanager.googleapis.com",        # Secret Manager
    "artifactregistry.googleapis.com",     # Artifact Registry
    "vpcaccess.googleapis.com",            # VPC Access Connector
    "cloudbuild.googleapis.com",           # Cloud Build
    "compute.googleapis.com",              # Compute Engine (VPC)
    "servicenetworking.googleapis.com",    # Private Service Access
    "iam.googleapis.com",                  # IAM
    "iamcredentials.googleapis.com",       # IAM Credentials (WIF)
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
