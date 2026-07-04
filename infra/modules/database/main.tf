# ============================================================
# Database Module — Cloud SQL PostgreSQL
# ============================================================

resource "google_sql_database_instance" "main" {
  name                = "erp-postgres-${var.environment}"
  project             = var.project_id
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = false

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_autoresize   = false
    disk_type         = "PD_SSD"

    ip_configuration {
      # Private IP is always on (Cloud Run reaches the DB over the VPC connector).
      # Public IP is opt-in via var.enable_public_ip so the Cloud SQL Auth Proxy
      # can connect from a local dev machine. authorized_networks is intentionally
      # NOT set → no direct IP access; only the IAM-authenticated Auth Proxy.
      #
      # NOTE: ssl_mode is intentionally left at the default
      # (ALLOW_UNENCRYPTED_AND_ENCRYPTED). Forcing ENCRYPTED_ONLY would reject the
      # deployed Cloud Run services, whose connection strings (module output
      # connection_url/direct_url) do not carry `sslmode=require`. Enforcing TLS
      # is a separate change: add sslmode=require to those outputs first, then
      # redeploy all services, THEN flip ssl_mode — otherwise running revisions break.
      ipv4_enabled    = var.enable_public_ip
      private_network = var.vpc_network
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }

    database_flags {
      name  = "max_connections"
      value = "50"
    }
  }
}

resource "google_sql_database" "erp" {
  name     = "erp_prototype"
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "erp_app"
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
