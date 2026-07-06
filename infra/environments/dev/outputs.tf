# ============================================================
# Outputs — Values needed after terraform apply
# ============================================================

# Cloud Run URLs không còn Terraform quản lý (Cloud Deploy sở hữu service). Lấy:
#   gcloud run services list --region=us-central1 \
#     --format='value(metadata.name,status.url)' --project=<project_id>

output "cloud_sql_instance" {
  description = "Cloud SQL instance connection name"
  value       = module.database.instance_connection_name
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${module.registry.repository_id}"
}

output "wif_provider" {
  description = "Workload Identity Federation provider (for GitHub Actions)"
  value       = module.workload_identity.provider_name
}

output "deployer_sa_email" {
  description = "Deployer service account email (for GitHub Actions)"
  value       = module.iam.deployer_sa_email
}

output "backend_sa_email" {
  description = "Backend runtime service account email (debug invoker/secret access)"
  value       = module.iam.backend_sa_email
}

output "frontend_sa_email" {
  description = "Frontend runtime service account email"
  value       = module.iam.frontend_sa_email
}

output "vpc_connector_id" {
  description = "VPC Connector ID"
  value       = module.networking.vpc_connector_id
}
