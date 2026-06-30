output "database_url_secret_id" {
  description = "Secret ID for DATABASE_URL"
  value       = google_secret_manager_secret.database_url.secret_id
}

output "database_direct_url_secret_id" {
  description = "Secret ID for DIRECT_URL"
  value       = google_secret_manager_secret.database_direct_url.secret_id
}

output "jwt_secret_id" {
  description = "Secret ID for JWT_SECRET"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}

output "upstash_redis_url_secret_id" {
  description = "Secret ID for UPSTASH_REDIS_REST_URL"
  value       = google_secret_manager_secret.upstash_redis_url.secret_id
}

output "upstash_redis_token_secret_id" {
  description = "Secret ID for UPSTASH_REDIS_REST_TOKEN"
  value       = google_secret_manager_secret.upstash_redis_token.secret_id
}
