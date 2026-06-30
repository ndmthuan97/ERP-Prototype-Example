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
      ipv4_enabled    = false
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
