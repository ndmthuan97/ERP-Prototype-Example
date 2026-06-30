# ============================================================
# Workload Identity Federation — GitHub Actions ↔ GCP (keyless)
# ============================================================

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool-${var.environment}"
  display_name              = "GitHub Actions Pool (${var.environment})"
  project                   = var.project_id
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions OIDC"
  project                            = var.project_id

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow GitHub Actions to impersonate the deployer service account
resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = var.deployer_sa_id
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}
