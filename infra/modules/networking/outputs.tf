output "vpc_id" {
  description = "VPC network ID"
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "vpc_connector_id" {
  description = "VPC Access Connector ID"
  value       = google_vpc_access_connector.connector.id
}

output "private_service_connection" {
  description = "Private Service Access connection"
  value       = google_service_networking_connection.private_service
}
