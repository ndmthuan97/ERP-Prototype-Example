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

# ============================================================
# Per-secret access — backend SA can read ONLY these five secrets
# (replaces the previous project-wide secretmanager.secretAccessor grant).
# ============================================================
resource "google_secret_manager_secret_iam_member" "backend_accessor" {
  for_each = {
    database_url        = google_secret_manager_secret.database_url.secret_id
    database_direct_url = google_secret_manager_secret.database_direct_url.secret_id
    jwt_secret          = google_secret_manager_secret.jwt_secret.secret_id
    upstash_redis_url   = google_secret_manager_secret.upstash_redis_url.secret_id
    upstash_redis_token = google_secret_manager_secret.upstash_redis_token.secret_id
  }

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.backend_sa_email}"
}
