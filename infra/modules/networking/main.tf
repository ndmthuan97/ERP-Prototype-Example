# ============================================================
# Networking Module — VPC + VPC Connector for Cloud SQL
# ============================================================

resource "google_compute_network" "vpc" {
  name                    = "erp-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "erp-subnet-${var.environment}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"
}

# Private IP range for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "erp-private-ip-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

# Private Service Access — connects VPC to Cloud SQL
resource "google_service_networking_connection" "private_service" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# VPC Connector — allows Cloud Run to access VPC (for Cloud SQL)
resource "google_vpc_access_connector" "connector" {
  name          = "erp-vpc-connector"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  machine_type  = "e2-micro"
  min_instances = 2
  max_instances = 3
}
