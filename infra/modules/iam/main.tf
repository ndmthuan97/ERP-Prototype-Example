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
  # NOTE: roles/secretmanager.secretAccessor is intentionally NOT granted
  # project-wide here — it is bound per-secret in the secrets module so the
  # backend SA can only read the five ERP secrets, not every secret in the
  # project (least privilege).
  for_each = toset([
    "roles/cloudsql.client",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
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
    # Required to manage the Domain Restricted Sharing org-policy override
    # (org-policy.tf), which every public Cloud Run service depends_on. Without
    # this the whole apply fails at the org-policy resource. Granted at project
    # scope; must be bootstrapped by an owner on the first apply.
    "roles/orgpolicy.policyAdmin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
