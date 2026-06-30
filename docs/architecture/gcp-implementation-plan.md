---
type: Runbook
title: "GCP Terraform Implementation Plan"
description: "Step-by-step implementation plan: Terraform modules, GitHub Actions workflows, Cloud Build config, Dockerfiles — ~37 files to create for GCP deployment"
tags: [runbook, terraform, gcp, implementation, deployment]
timestamp: "2026-06-30T10:12:00+07:00"
---

# GCP Terraform Implementation Plan

> Plan chi tiết để implement hạ tầng GCP bằng Terraform. Bao gồm code snippets, file structure, config cho từng module. Tổng ~37 files mới.

> Liên quan: [GCP Cloud Architecture](./gcp-cloud-architecture.md) · [CI/CD Pipeline](./cicd-pipeline.md) · [Event Flows](./event-flows.md)

---

## Decisions đã thống nhất

| # | Decision | Chọn |
|---|---|---|
| 1 | Region | `us-central1` (Iowa) — Tier 1, rẻ nhất |
| 2 | Database | Cloud SQL `db-f1-micro` (~$7-10/month) |
| 3 | Cache | **Giữ Upstash Redis REST API** (FREE) — zero code change |
| 4 | Environments | Chỉ `dev` (1 environment) |
| 5 | Domain | Cloud Run default URL (*.run.app) |
| 6 | CI | GitHub Actions (lint, test, build Docker, push Artifact Registry) |
| 7 | CD | Cloud Build (deploy to Cloud Run) |
| 8 | GCP Auth | Workload Identity Federation (keyless) |
| 9 | RBAC | 1 GitHub Environment `dev`, auto deploy |
| 10 | Build | Monorepo path filters — chỉ build service thay đổi |
| 11 | GCP Project | Có sẵn, $300 free credit |

---

## Chi phí ước tính (us-central1, Tier 1)

| Service | Cost/month | Note |
|---|---|---|
| Cloud SQL `db-f1-micro` | **~$7-10** | 0.6GB RAM, 10GB SSD |
| Cloud Run (8 services) | **~$0-5** | Scale-to-zero, free tier covers most |
| Cloud Pub/Sub | **~$0** | First 10GB free |
| Secret Manager | **~$0** | First 10K access/month free |
| Artifact Registry | **~$0-1** | Pay per GB stored |
| VPC Connector | **~$7** | e2-micro, always-on |
| Upstash Redis | **$0** | Free tier |
| GitHub Actions | **$0** | 2000 min/month free |
| **Tổng** | **~$15-20/month** | |

> [!TIP]
> Với $300 free credit → chạy được **~15-20 tháng** miễn phí.

---

## Cấu trúc thư mục cần tạo

```
erp-prototype-example/
├── .github/                                    # [NEW] GitHub configuration
│   └── workflows/                              # GitHub Actions CI workflows
│       ├── ci-backend.yml                      # CI: lint, test, build backend services
│       ├── ci-frontend.yml                     # CI: lint, typecheck, build frontend
│       └── deploy.yml                          # Trigger Cloud Build CD
│
├── infra/                                      # [NEW] Terraform IaC
│   ├── README.md                               # Hướng dẫn setup & usage
│   ├── .gitignore                              # Ignore .terraform/, *.tfstate, *.tfvars
│   │
│   ├── environments/                           # Per-environment config
│   │   └── dev/                                # Dev environment (only one)
│   │       ├── main.tf                         # Root module, calls all modules
│   │       ├── variables.tf                    # Variable declarations
│   │       ├── terraform.tfvars.example        # Template (copy → terraform.tfvars)
│   │       ├── outputs.tf                      # Output values
│   │       ├── providers.tf                    # Google provider + API enables
│   │       └── backend.tf                      # GCS remote state
│   │
│   └── modules/                                # Reusable Terraform modules
│       ├── networking/                         # VPC + VPC Connector
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── database/                           # Cloud SQL PostgreSQL
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── pubsub/                             # Cloud Pub/Sub (8 topics, 4 subs)
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── secrets/                            # Secret Manager
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── registry/                           # Artifact Registry
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── cloud-run/                          # Cloud Run (reusable per service)
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       ├── iam/                                # Service Accounts + role bindings
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       │
│       └── workload-identity/                  # GitHub ↔ GCP OIDC Federation
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
│
├── cloudbuild.yaml                             # [NEW] Cloud Build CD config
│
├── backend/                                    # (existing — minimal changes)
│   ├── Dockerfile                              # (existing — no change)
│   └── .env.example                            # (modify — add production comments)
│
├── frontend/                                   # (existing — add Dockerfile)
│   ├── Dockerfile                              # [NEW] Multi-stage Next.js build
│   └── next.config.mjs                         # (modify — add output: 'standalone')
│
└── docs/                                       # (existing)
```

---

## Steps — Terraform Modules

### Step 1: `infra/environments/dev/providers.tf`

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 6.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
```

GCP API enables (via `google_project_service`):
- `run.googleapis.com`, `sqladmin.googleapis.com`, `pubsub.googleapis.com`
- `secretmanager.googleapis.com`, `artifactregistry.googleapis.com`
- `vpcaccess.googleapis.com`, `cloudbuild.googleapis.com`
- `compute.googleapis.com`, `servicenetworking.googleapis.com`
- `iam.googleapis.com`, `iamcredentials.googleapis.com`

### Step 2: `infra/environments/dev/backend.tf`

```hcl
terraform {
  backend "gcs" {
    bucket = "erp-prototype-tfstate"
    prefix = "dev"
  }
}
```

### Step 3: `infra/environments/dev/variables.tf`

```hcl
variable "project_id"  { type = string }
variable "region"      { type = string, default = "us-central1" }
variable "db_password" { type = string, sensitive = true }
variable "jwt_secret"  { type = string, sensitive = true }
variable "github_repo" { type = string, default = "your-org/erp-prototype-example" }
```

### Step 4: `infra/environments/dev/main.tf`

```hcl
module "networking"         { source = "../../modules/networking"         ... }
module "database"           { source = "../../modules/database"           ... }
module "pubsub"             { source = "../../modules/pubsub"             ... }
module "secrets"            { source = "../../modules/secrets"            ... }
module "registry"           { source = "../../modules/registry"           ... }
module "iam"                { source = "../../modules/iam"                ... }
module "workload_identity"  { source = "../../modules/workload-identity"  ... }

module "cloud_run" {
  for_each = local.services    # 8 services loop
  source   = "../../modules/cloud-run"
  ...
}
```

---

### Step 5: Module `networking/`

| Resource | Purpose |
|---|---|
| `google_compute_network` | Custom VPC `erp-vpc` |
| `google_compute_global_address` | Private IP range `/20` for Cloud SQL |
| `google_service_networking_connection` | Private Service Access |
| `google_vpc_access_connector` | Cloud Run → VPC (`e2-micro`, min 2 / max 3 instances) |

> VPC Connector cần thiết vì Cloud SQL dùng private IP. Upstash Redis qua HTTPS nên **không cần** đi qua VPC.

---

### Step 6: Module `database/`

| Resource | Config |
|---|---|
| `google_sql_database_instance` | PostgreSQL 16, `db-f1-micro`, private IP only |
| `google_sql_database` | `erp_prototype` |
| `google_sql_user` | `erp_app` + password |

```hcl
settings {
  tier              = "db-f1-micro"
  availability_type = "ZONAL"           # No HA (save cost)
  disk_size         = 10                # 10GB SSD
  disk_autoresize   = false             # Fixed (save cost)

  ip_configuration {
    ipv4_enabled    = false             # No public IP
    private_network = var.vpc_id
  }

  backup_configuration {
    enabled    = true
    start_time = "03:00"                # 03:00 UTC daily
  }
}

deletion_protection = false             # Dev only — easy teardown
```

> DB schemas (`app_auth`, `customer`, `sales`, `inventory`, `catalog`, `purchasing`) tạo bằng Prisma migrate, **không** qua Terraform.

---

### Step 7: Module `pubsub/`

Topics + Subscriptions (mapped từ [Event Flows](./event-flows.md)):

| Topic | Subscriptions |
|---|---|
| `customer.created` | _(none yet)_ |
| `customer.updated` | _(none yet)_ |
| `sales-order.submitted` | _(notification only)_ |
| `sales-order.confirmed` | _(none yet)_ |
| `sales-order.cancelled` | `inventory-service.sales-order.cancelled` |
| `sales-order.fulfilled` | `inventory-service.sales-order.fulfilled` |
| `product.created` | `inventory-service.product.created` |
| `goods.received` | `inventory-service.goods.received` |
| `dead-letter` | `dead-letter-sub` (DLQ) |

Config per subscription:
- `ack_deadline_seconds = 60`
- `message_retention_duration = "604800s"` (7 days)
- `dead_letter_policy.max_delivery_attempts = 5`

---

### Step 8: Module `secrets/`

| Secret | Source |
|---|---|
| `database-url` | Cloud SQL connection string (auto-generated by Terraform) |
| `database-direct-url` | Cloud SQL direct connection (for Prisma migrate) |
| `jwt-secret` | From `var.jwt_secret` |
| `upstash-redis-url` | From `var.upstash_redis_url` |
| `upstash-redis-token` | From `var.upstash_redis_token` |

---

### Step 9: Module `registry/`

```hcl
resource "google_artifact_registry_repository" "erp" {
  repository_id = "erp-services"
  format        = "DOCKER"
  location      = var.region
}
```

Images: `us-central1-docker.pkg.dev/{project}/erp-services/{service-name}:{tag}`

---

### Step 10: Module `cloud-run/`

Reusable module — called 8 times via `for_each`:

| Config | Backend Services | Frontend |
|---|---|---|
| CPU | 1 | 1 |
| Memory | 512Mi | 256Mi |
| Min instances | 0 | 0 |
| Max instances | 3 | 2 |
| Concurrency | 80 | 80 |
| VPC Connector | ✅ | ❌ (no DB access) |
| VPC Egress | `private-ranges-only` | N/A |
| Ingress | `internal` | `all` (public) |

**Exception:** API Gateway + Frontend → `ingress = "all"` (public)

Env vars injection per service:

| Env Var | Source | Services |
|---|---|---|
| `NODE_ENV` | `"production"` | All |
| `PUBSUB_PROJECT_ID` | `var.project_id` | All backend |
| `DATABASE_URL` | Secret Manager ref | All backend |
| `UPSTASH_REDIS_REST_URL` | Secret Manager ref | All backend |
| `UPSTASH_REDIS_REST_TOKEN` | Secret Manager ref | All backend |
| `JWT_SECRET` | Secret Manager ref | Auth, Gateway |
| `AUTH_SERVICE_URL` | Cloud Run URL | Gateway |
| `CUSTOMER_SERVICE_URL` | Cloud Run URL | Gateway |
| `ORDER_SERVICE_URL` | Cloud Run URL | Gateway |
| `INVENTORY_SERVICE_URL` | Cloud Run URL | Gateway |
| `CATALOG_SERVICE_URL` | Cloud Run URL | Gateway |
| `PURCHASING_SERVICE_URL` | Cloud Run URL | Gateway |

> [!IMPORTANT]
> **No `PUBSUB_EMULATOR_HOST`** → SDK tự kết nối Pub/Sub thật → zero code change (ADR-005).

---

### Step 11: Module `iam/`

| Service Account | Roles | Used By |
|---|---|---|
| `erp-backend` | `cloudsql.client`, `pubsub.publisher`, `pubsub.subscriber`, `secretmanager.secretAccessor`, `run.invoker` | Backend Cloud Run services |
| `erp-frontend` | — | Frontend Cloud Run service |
| `erp-deployer` | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `cloudbuild.builds.editor` | Cloud Build CD |

---

### Step 12: Module `workload-identity/`

Workload Identity Federation cho GitHub Actions → GCP (keyless auth):

```hcl
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_provider_id = "github-provider"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
  attribute_condition = "assertion.repository == '${var.github_repo}'"
}

resource "google_service_account_iam_binding" "wif_binding" {
  service_account_id = var.deployer_sa_id
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "principalSet://iam.googleapis.com/${pool_name}/attribute.repository/${var.github_repo}"
  ]
}
```

---

## Steps — GitHub Actions Workflows

### Step 13: `.github/workflows/ci-backend.yml`

```yaml
name: CI — Backend

on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      shared: ${{ steps.filter.outputs.shared }}
      services: ${{ steps.filter.outputs.services }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            shared: 'backend/shared/**'
            auth: 'backend/auth-service/**'
            customer: 'backend/customer-service/**'
            sales: 'backend/sales-service/**'
            inventory: 'backend/inventory-service/**'
            catalog: 'backend/catalog-service/**'
            purchasing: 'backend/purchasing-service/**'
            gateway: 'backend/api-gateway/**'

  build-and-push:
    needs: detect-changes
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      id-token: write
      contents: read
    strategy:
      matrix:
        service: [auth-service, customer-service, sales-service, ...]
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOYER_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-central1-docker.pkg.dev
      - run: |
          docker build \
            --build-arg SERVICE_DIR=${{ matrix.service }} \
            -t us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/erp-services/${{ matrix.service }}:${{ github.sha }} \
            -f backend/Dockerfile backend/
      - run: docker push ...
```

### Step 14: `.github/workflows/ci-frontend.yml`

```yaml
name: CI — Frontend

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOYER_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-central1-docker.pkg.dev
      - run: |
          docker build \
            -t us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/erp-services/frontend:${{ github.sha }} \
            frontend/
      - run: docker push ...
```

### Step 15: `.github/workflows/deploy.yml`

```yaml
name: CD — Deploy via Cloud Build

on:
  workflow_run:
    workflows: ["CI — Backend", "CI — Frontend"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOYER_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud builds submit \
            --config=cloudbuild.yaml \
            --substitutions=_TAG=${{ github.event.workflow_run.head_sha }}
```

---

## Steps — Cloud Build & Code Changes

### Step 16: `cloudbuild.yaml`

```yaml
steps:
  - id: deploy-auth
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: ['run', 'deploy', 'auth-service',
           '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/erp-services/auth-service:${_TAG}',
           '--region', 'us-central1', '--platform', 'managed',
           '--vpc-connector', 'erp-vpc-connector',
           '--vpc-egress', 'private-ranges-only']

  # ... repeat for each of 7 backend services

  - id: deploy-frontend
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: ['run', 'deploy', 'frontend',
           '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/erp-services/frontend:${_TAG}',
           '--region', 'us-central1', '--allow-unauthenticated']

substitutions:
  _TAG: latest
timeout: '1200s'
```

### Step 17: `frontend/Dockerfile` [NEW]

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Step 18: `frontend/next.config.mjs` [MODIFY]

```diff
 const nextConfig = {
   reactStrictMode: true,
+  output: 'standalone',  // Required for Docker deployment
   transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
 };
```

### Step 19: `backend/.env.example` [MODIFY]

```diff
 # --- GCP Pub/Sub ---
-PUBSUB_EMULATOR_HOST=localhost:8085
+# LOCAL DEV: uncomment line below
+# PUBSUB_EMULATOR_HOST=localhost:8085
+# PRODUCTION: Do NOT set PUBSUB_EMULATOR_HOST → SDK auto-connects to real Pub/Sub
 PUBSUB_PROJECT_ID=erp-prototype
```

---

## Verification Plan

### Terraform Validation

```bash
cd infra/environments/dev
terraform init
terraform validate
terraform plan -var-file=terraform.tfvars
```

### Post-Apply Verification

1. `terraform apply` → confirm all resources created
2. Verify Cloud SQL: connect via Cloud SQL Auth Proxy → run Prisma migrate
3. Verify Pub/Sub: check topics/subscriptions in GCP Console
4. Verify Secret Manager: all 5 secrets accessible
5. Verify Workload Identity: GitHub Actions can authenticate

### CI/CD Verification

1. Push to `main` → GitHub Actions triggers CI
2. CI builds Docker images → pushes to Artifact Registry
3. Deploy workflow → triggers Cloud Build
4. Cloud Build deploys to Cloud Run
5. `curl https://<api-gateway-url>/health` → `200 OK`
6. Full E2E: Create Customer → Create Order → Saga runs → verify Pub/Sub delivery

---

## Summary

| # | Component | Files | Key Resources |
|---|---|---|---|
| 1 | Terraform env/dev | 6 files | providers, backend, variables, main, outputs |
| 2 | Module: networking | 3 files | VPC, VPC Connector |
| 3 | Module: database | 3 files | Cloud SQL `db-f1-micro` |
| 4 | Module: pubsub | 3 files | 8 topics, 4 subscriptions, 1 DLQ |
| 5 | Module: secrets | 3 files | 5 secrets |
| 6 | Module: registry | 3 files | Artifact Registry repo |
| 7 | Module: cloud-run | 3 files | 8 Cloud Run services |
| 8 | Module: iam | 3 files | 3 service accounts |
| 9 | Module: workload-identity | 3 files | WIF pool + provider |
| 10 | GitHub Actions | 3 files | ci-backend, ci-frontend, deploy |
| 11 | Cloud Build | 1 file | cloudbuild.yaml |
| 12 | Code changes | 3 files | Dockerfile.frontend, next.config, .env.example |
| **Total** | | **~37 files** | |

**Cost: ~$15-20/month** (covered by $300 free credit for ~15-20 months)

---

## Related Concepts

- [GCP Cloud Architecture](./gcp-cloud-architecture.md) — kiến trúc tổng quan GCP
- [CI/CD Pipeline](./cicd-pipeline.md) — chi tiết pipeline flow và RBAC
- [Event Flows](./event-flows.md) — Pub/Sub topics mapping
- [System Overview](./system-overview.md) — kiến trúc local hiện tại
- [Tech Decisions](../overview/tech-decisions.md) — ADR-005: Pub/Sub zero code change
