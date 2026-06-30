# ERP Prototype — Terraform Infrastructure

Terraform IaC for deploying the ERP Prototype to Google Cloud Platform.

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
2. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`)
3. GCP Project with billing enabled
4. `gcloud auth application-default login`

## Quick Start

```bash
# 1. Create GCS bucket for Terraform state
gcloud storage buckets create gs://erp-prototype-tfstate \
  --location=us-central1 \
  --uniform-bucket-level-access

# 2. Copy and fill in your variables
cd infra/environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize Terraform
terraform init

# 4. Review the plan
terraform plan

# 5. Apply
terraform apply
```

## Post-Apply Steps

1. **Run Prisma Migrate** (DB schemas are NOT managed by Terraform):
   ```bash
   # Connect via Cloud SQL Auth Proxy
   gcloud sql connect erp-postgres-dev --database=erp_prototype --user=erp_app
   ```

2. **Push initial Docker images** (Cloud Run needs at least one image to start):
   ```bash
   cd backend
   docker build --build-arg SERVICE_DIR=auth-service -t us-central1-docker.pkg.dev/<PROJECT>/erp-services/auth-service:latest -f Dockerfile .
   docker push us-central1-docker.pkg.dev/<PROJECT>/erp-services/auth-service:latest
   # Repeat for all services...
   ```

3. **Configure GitHub Environment Variables**:
   - `GCP_PROJECT` — your GCP project ID
   - `WIF_PROVIDER` — from `terraform output wif_provider`
   - `DEPLOYER_SA` — from `terraform output deployer_sa_email`

## Module Structure

```
infra/
├── environments/dev/    # Environment-specific config
│   ├── providers.tf     # Google provider + API enables
│   ├── backend.tf       # GCS remote state
│   ├── variables.tf     # Input variables
│   ├── main.tf          # Module orchestration
│   └── outputs.tf       # Output values
│
└── modules/             # Reusable modules
    ├── networking/       # VPC + VPC Connector
    ├── database/         # Cloud SQL PostgreSQL
    ├── pubsub/           # Pub/Sub Topics + Subscriptions
    ├── secrets/          # Secret Manager
    ├── registry/         # Artifact Registry
    ├── cloud-run/        # Cloud Run (per service)
    ├── iam/              # Service Accounts
    └── workload-identity/# GitHub ↔ GCP OIDC
```

## Teardown

```bash
terraform destroy
```

> **Warning**: This will delete ALL resources including the database. Make sure to back up data first.
