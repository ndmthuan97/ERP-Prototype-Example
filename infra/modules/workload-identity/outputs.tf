output "pool_name" {
  description = "Workload Identity Pool name"
  value       = google_iam_workload_identity_pool.github.name
}

output "provider_name" {
  description = "Workload Identity Provider name (for GitHub Actions auth)"
  value       = google_iam_workload_identity_pool_provider.github.name
}
