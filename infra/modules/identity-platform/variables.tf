variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "authorized_domains" {
  type        = list(string)
  default     = ["localhost"]
  description = <<-EOT
    Domains allowed to complete Google sign-in via Identity Platform (OAuth
    redirect). Keep localhost for local dev and add the Cloud Run frontend
    domain when the app is deployed.
  EOT
}

variable "google_oauth_client_id" {
  type        = string
  description = <<-EOT
    OAuth 2.0 Web client ID for Google sign-in. Created MANUALLY in the Console
    (APIs & Services -> Credentials) — Terraform cannot create the OAuth consent
    screen, so the client is provided by hand.
  EOT
}

variable "google_oauth_client_secret" {
  type        = string
  sensitive   = true
  description = "OAuth 2.0 Web client secret paired with google_oauth_client_id (manually created — see google_oauth_client_id)."
}
