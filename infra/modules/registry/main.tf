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

    # Keep enough recent images that a rollback to an older commit SHA (via
    # deploy.yml) still finds its image. 5 was too aggressive — a handful of
    # merges could GC the SHA you want to roll back to.
    most_recent_versions {
      keep_count = 20
    }
  }
}
