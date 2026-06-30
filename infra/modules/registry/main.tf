# ============================================================
# Registry Module — Artifact Registry for Docker images
# ============================================================

resource "google_artifact_registry_repository" "erp" {
  repository_id = "erp-services"
  project       = var.project_id
  location      = var.region
  format        = "DOCKER"
  description   = "Docker images for ERP Prototype services"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }
}
