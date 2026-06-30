output "repository_id" {
  description = "Artifact Registry repository ID"
  value       = google_artifact_registry_repository.erp.repository_id
}

output "repository_url" {
  description = "Full Artifact Registry URL"
  value       = "${google_artifact_registry_repository.erp.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.erp.repository_id}"
}
