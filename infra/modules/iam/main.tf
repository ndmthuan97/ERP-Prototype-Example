# ============================================================
# IAM Module — Service Accounts + Role Bindings
# ============================================================

# --- Backend Service Account (shared by all backend services) ---

resource "google_service_account" "backend" {
  account_id   = "erp-backend-${var.environment}"
  display_name = "ERP Backend Service Account (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "backend_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/secretmanager.secretAccessor",
    "roles/run.invoker",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# --- Frontend Service Account ---

resource "google_service_account" "frontend" {
  account_id   = "erp-frontend-${var.environment}"
  display_name = "ERP Frontend Service Account (${var.environment})"
  project      = var.project_id
}

# --- Deployer Service Account (for Cloud Build + GitHub Actions) ---

resource "google_service_account" "deployer" {
  account_id   = "erp-deployer-${var.environment}"
  display_name = "ERP Deployer Service Account (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/cloudbuild.builds.editor",
    "roles/storage.admin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
