terraform {
  backend "gcs" {
    bucket = "erp-prototype-tfstate"
    prefix = "dev"
  }
}
