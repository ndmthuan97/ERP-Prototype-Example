# ============================================================
# Root Module — Orchestrates all infrastructure modules
# ============================================================

locals {
  # ⚠️ SPEC Cloud Run (port/memory/env/secret/VPC/probe) KHÔNG còn ở Terraform.
  # Kể từ khi chuyển sang Google Cloud Deploy, nguồn sự thật của spec service là
  # các manifest trong deploy/manifests/*.yaml (render qua deploy/skaffold.yaml).
  # Terraform CHỈ còn lo: nền tảng (VPC/DB/secret/SA/registry/WIF) + các IAM
  # binding của service. Xem docs/architecture/cicd-pipeline.md + deploy/MIGRATION.md.

  # Service công khai (allUsers có roles/run.invoker). Chỉ gateway + frontend.
  public_services = ["api-gateway", "frontend"]

  # Backend private mà api-gateway proxy tới: gateway mint ID token/request và gọi
  # thẳng, nên runtime SA của gateway (erp-backend-<env>, chung với backend) cần
  # roles/run.invoker trên từng service. = mọi backend TRỪ chính gateway.
  gateway_invokable_services = [
    "auth-service",
    "customer-service",
    "sales-service",
    "inventory-service",
    "catalog-service",
    "purchasing-service",
  ]
}

# ============================================================
# Module: Networking (VPC + VPC Connector)
# ============================================================

module "networking" {
  source = "../../modules/networking"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  depends_on = [google_project_service.apis]
}

# ============================================================
# Module: Database (Cloud SQL PostgreSQL)
# ============================================================

module "database" {
  source = "../../modules/database"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  db_tier     = var.db_tier
  db_password = var.db_password
  vpc_network = module.networking.vpc_id

  # Keep a public IP allocated so the Cloud SQL Auth Proxy can be run from a local
  # dev machine (see docs/operations/run-backend-with-prod-config.md). Access stays IAM-gated:
  # authorized_networks is empty, so only the Auth Proxy can connect. Flip to false
  # to return to private-only.
  enable_public_ip = true

  depends_on = [module.networking]
}

# ============================================================
# Module: Pub/Sub (Topics + Subscriptions)
# ============================================================

module "pubsub" {
  source = "../../modules/pubsub"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.apis]
}

# ============================================================
# Module: Secrets (Secret Manager)
# ============================================================

module "secrets" {
  source = "../../modules/secrets"

  project_id          = var.project_id
  environment         = var.environment
  database_url        = module.database.connection_url
  database_direct_url = module.database.direct_url
  jwt_secret          = var.jwt_secret
  upstash_redis_url   = var.upstash_redis_url
  upstash_redis_token = var.upstash_redis_token
  backend_sa_email    = module.iam.backend_sa_email

  depends_on = [module.database, module.iam]
}

# ============================================================
# Module: Artifact Registry
# ============================================================

module "registry" {
  source = "../../modules/registry"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  depends_on = [google_project_service.apis]
}

# ============================================================
# Module: IAM (Service Accounts)
# ============================================================

module "iam" {
  source = "../../modules/iam"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.apis]
}

# ============================================================
# Module: Identity Platform (Google sign-in / Firebase Auth GA)
# ============================================================
# Backs migration B1 — auth-service verifies Google ID tokens via Firebase
# Admin. Enables Identity Platform, configures the Google IdP, and provisions
# the auth-svc-admin runtime SA with roles/firebaseauth.admin. The module owns
# its own google_project_service (identitytoolkit), so no depends_on the central
# google_project_service.apis here.

module "identity_platform" {
  source = "../../modules/identity-platform"

  project_id                 = var.project_id
  authorized_domains         = var.auth_authorized_domains
  google_oauth_client_id     = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret
}

# Firebase Auth admin for the CURRENTLY-RUNNING auth-service.
# The auth-service runs under the shared backend runtime SA (erp-backend-<env>),
# and its Cloud Run spec is owned by Google Cloud Deploy (deploy/auth-service/
# service.yaml), NOT Terraform — so swapping its runtime identity to
# auth-svc-admin from here is not possible without an invasive manifest change.
# Lower-risk choice: grant firebaseauth.admin to the existing backend SA so the
# running auth-service can verifyIdToken / revokeRefreshTokens today. When the
# auth-service manifest is updated to run as
# module.identity_platform.auth_service_account_email, drop this binding.
resource "google_project_iam_member" "auth_service_firebaseauth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${module.iam.backend_sa_email}"

  depends_on = [module.iam]
}

# ============================================================
# Module: Workload Identity Federation (GitHub ↔ GCP)
# ============================================================

module "workload_identity" {
  source = "../../modules/workload-identity"

  project_id     = var.project_id
  environment    = var.environment
  github_repo    = var.github_repo
  deployer_sa_id = module.iam.deployer_sa_id

  depends_on = [module.iam]
}

# ============================================================
# Cloud Run Services — KHÔNG còn do Terraform quản lý
# ============================================================
# Trước đây `module.cloud_run` (for_each 8 service) tạo google_cloud_run_v2_service
# và inject URL gateway qua null_resource. Giờ Google Cloud Deploy sở hữu spec +
# rollout (deploy/manifests/*.yaml). Terraform chỉ giữ IAM binding của service
# bên dưới.
#
# ⚠️ BÀN GIAO STATE (làm 1 lần, TRƯỚC `terraform apply` đầu tiên sau thay đổi này):
#   terraform state rm 'module.cloud_run'
#   terraform state rm 'null_resource.gateway_env_vars'
# → gỡ service khỏi state mà KHÔNG destroy (service vẫn chạy, Cloud Deploy tiếp
#   quản). Nếu bỏ bước này, `apply` sẽ hiện "8 to destroy" — DỪNG, đừng approve.
# Chi tiết: deploy/MIGRATION.md.

# ============================================================
# IAM: quyền truy cập các Cloud Run service (do Cloud Deploy tạo)
# ============================================================
# Các binding này tham chiếu service THEO TÊN (literal) — service phải TỒN TẠI
# lúc apply (đã chạy sẵn khi bàn giao, hoặc do release Cloud Deploy đầu tiên tạo).
# Bootstrap từ số 0 (chưa có service): đặt enable_service_iam=false cho apply đầu,
# chạy 1 release, rồi bật lại true.

# Public: allUsers có roles/run.invoker cho gateway + frontend.
resource "google_cloud_run_v2_service_iam_member" "public" {
  for_each = var.enable_service_iam ? toset(local.public_services) : toset([])

  project  = var.project_id
  location = var.region
  name     = "${each.value}-${var.environment}"
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Gateway → 6 backend private: runtime SA của gateway (erp-backend-<env>) có
# roles/run.invoker trên từng service, scoped ở cấp resource (least privilege).
resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  for_each = var.enable_service_iam ? toset(local.gateway_invokable_services) : toset([])

  project  = var.project_id
  location = var.region
  name     = "${each.value}-${var.environment}"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${module.iam.backend_sa_email}"
}

# NOTE: URL downstream + CORS của gateway (trước inject bằng null_resource) giờ
# khai THẲNG trong deploy/manifests/api-gateway.yaml (env vars). Điền URL Cloud Run
# thật 1 lần theo deploy/MIGRATION.md trước release đầu tiên.

