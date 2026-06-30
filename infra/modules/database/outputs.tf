output "instance_connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.main.private_ip_address
}

output "connection_url" {
  description = "PostgreSQL connection URL via Cloud SQL Proxy (pooled)"
  value       = "postgresql://${google_sql_user.app.name}:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.erp.name}?schema=public"
  sensitive   = true
}

output "direct_url" {
  description = "PostgreSQL direct connection URL (for Prisma migrate)"
  value       = "postgresql://${google_sql_user.app.name}:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.erp.name}?schema=public"
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.erp.name
}
