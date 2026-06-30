output "backend_sa_email" {
  description = "Backend service account email"
  value       = google_service_account.backend.email
}

output "frontend_sa_email" {
  description = "Frontend service account email"
  value       = google_service_account.frontend.email
}

output "deployer_sa_email" {
  description = "Deployer service account email"
  value       = google_service_account.deployer.email
}

output "deployer_sa_id" {
  description = "Deployer service account ID (for WIF binding)"
  value       = google_service_account.deployer.id
}
