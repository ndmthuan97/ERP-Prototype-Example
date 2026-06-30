variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "service_name" {
  type        = string
  description = "Service name (e.g. customer-service)"
}

variable "image" {
  type        = string
  description = "Container image URL"
}

variable "container_port" {
  type        = number
  description = "Container listening port"
}

variable "cpu" {
  type        = string
  default     = "1"
  description = "CPU limit"
}

variable "memory" {
  type        = string
  default     = "512Mi"
  description = "Memory limit"
}

variable "max_instances" {
  type        = number
  default     = 3
  description = "Max instance count"
}

variable "concurrency" {
  type        = number
  default     = 80
  description = "Max concurrent requests per instance"
}

variable "ingress" {
  type        = string
  default     = "internal"
  description = "Ingress setting: 'all' or 'internal'"
}

variable "is_public" {
  type        = bool
  default     = false
  description = "Allow unauthenticated access"
}

variable "vpc_connector" {
  type        = string
  default     = null
  description = "VPC Connector ID (null = no VPC access)"
}

variable "service_account_email" {
  type        = string
  description = "Service account email for the Cloud Run service"
}

variable "env_vars" {
  type        = map(string)
  default     = {}
  description = "Plain environment variables"
}

variable "secret_env_vars" {
  type        = map(string)
  default     = {}
  description = "Secret Manager references (key = env var name, value = secret ID)"
}
