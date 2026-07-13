output "auth_service_account_email" {
  description = "Auth-service runtime SA email (holds roles/firebaseauth.admin). Attach to the auth-service Cloud Run manifest to run as this identity."
  value       = google_service_account.auth_admin.email
}
