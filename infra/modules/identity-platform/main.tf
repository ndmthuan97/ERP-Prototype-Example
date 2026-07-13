# ============================================================
# Identity Platform Module — Google sign-in (Firebase Auth GA)
# ============================================================
# Backs migration B1: the auth-service uses Firebase Admin to verify Google ID
# tokens (verifyIdToken) and revoke refresh tokens (revokeRefreshTokens).
#
# This module codifies ONLY the infra-provisionable parts:
#   - enable the Identity Platform (Identity Toolkit) API
#   - project-level Identity Platform config (authorized domains)
#   - Google IdP config (client_id/secret from a MANUALLY-created OAuth client)
#   - the auth-service runtime SA + roles/firebaseauth.admin binding
#
# NOT managed here (manual / not Terraform-provisionable): the OAuth consent
# screen and OAuth 2.0 Web client (Terraform cannot create the consent screen),
# and the web SDK config (apiKey / authDomain) the frontend copies from the
# Console. See terraform.tfvars.example for what the operator must supply.

# --- Enable Identity Platform (Identity Toolkit) API ---
# Defined inside the module ON PURPOSE rather than in the env's central
# required_apis list: adding an entry to that shared google_project_service.apis
# set perturbs the resource and defers project.number reads in other modules
# (see the clouddeploy note in environments/dev/providers.tf), which triggers
# spurious IAM churn. Keeping it module-local mirrors how clouddeploy is handled.
resource "google_project_service" "identitytoolkit" {
  project            = var.project_id
  service            = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

# --- Identity Platform project config (authorized domains) ---
resource "google_identity_platform_config" "default" {
  project            = var.project_id
  authorized_domains = var.authorized_domains

  depends_on = [google_project_service.identitytoolkit]
}

# --- Google sign-in IdP ---
# client_id / client_secret come from a manually-created OAuth 2.0 Web client
# (Console -> APIs & Services -> Credentials) tied to a configured consent
# screen. Terraform can create the IdP binding but NOT the underlying OAuth
# client or consent screen.
resource "google_identity_platform_default_supported_idp_config" "google" {
  project       = var.project_id
  idp_id        = "google.com"
  enabled       = true
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.default]
}

# --- Auth-service runtime identity ---
# Dedicated SA representing the auth-service's Firebase Admin identity. Env-
# agnostic account_id (single-project prototype) per the B1 spec.
#
# NOTE: NO google_service_account_key here — a key would leak the private key
# into tfstate. Local dev uses ADC (gcloud auth application-default login); on
# Cloud Run the auth-service assumes an SA via its deploy manifest.
resource "google_service_account" "auth_admin" {
  account_id   = "auth-svc-admin"
  display_name = "ERP Auth Service - Firebase Admin runtime identity"
  project      = var.project_id
}

# Grant Firebase Auth admin so the auth-service can verifyIdToken /
# revokeRefreshTokens against Identity Platform.
resource "google_project_iam_member" "auth_admin_firebaseauth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.auth_admin.email}"
}
