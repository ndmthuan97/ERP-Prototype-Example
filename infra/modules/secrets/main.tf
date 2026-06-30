# ============================================================
# Secrets Module — Secret Manager
# ============================================================

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url
}

resource "google_secret_manager_secret" "database_direct_url" {
  secret_id = "database-direct-url-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_direct_url" {
  secret      = google_secret_manager_secret.database_direct_url.id
  secret_data = var.database_direct_url
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "upstash_redis_url" {
  secret_id = "upstash-redis-url-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "upstash_redis_url" {
  secret      = google_secret_manager_secret.upstash_redis_url.id
  secret_data = var.upstash_redis_url
}

resource "google_secret_manager_secret" "upstash_redis_token" {
  secret_id = "upstash-redis-token-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "upstash_redis_token" {
  secret      = google_secret_manager_secret.upstash_redis_token.id
  secret_data = var.upstash_redis_token
}
