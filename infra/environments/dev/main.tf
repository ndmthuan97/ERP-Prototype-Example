# ============================================================
# Root Module — Orchestrates all infrastructure modules
# ============================================================

locals {
  # Service definitions for Cloud Run.
  #
  # ingress = "all" for backend services does NOT make them public: is_public =
  # false means no allUsers invoker binding, so only callers holding
  # roles/run.invoker (the api-gateway's runtime SA) can reach them — the gateway
  # mints a per-request ID token. ingress = "internal" was the original intent but
  # the gateway's VPC egress is private-ranges-only and the VPC has no Cloud NAT,
  # so gateway→service calls over the public *.run.app URL never entered the VPC
  # and Cloud Run answered 404. IAM-gated ingress = "all" is the simplest correct
  # posture here (alternative: Cloud NAT + gateway egress = all-traffic).
  backend_services = {
    "api-gateway" = {
      port      = 3010
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = true
    }
    "auth-service" = {
      port      = 3004
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
    "customer-service" = {
      port      = 3001
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
    "sales-service" = {
      port      = 3002
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
    "inventory-service" = {
      port      = 3003
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
    "catalog-service" = {
      port      = 3005
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
    "purchasing-service" = {
      port      = 3006
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = true
      is_public = false
    }
  }

  frontend_service = {
    "frontend" = {
      # Must match the frontend Dockerfile's baked PORT/EXPOSE (8080), otherwise
      # Cloud Run routes to a port the Next standalone server isn't listening on.
      port      = 8080
      memory    = "512Mi"
      cpu       = "1"
      ingress   = "all"
      needs_vpc = false
      is_public = true
    }
  }

  all_services = merge(local.backend_services, local.frontend_service)

  # Private downstream services the api-gateway proxies to. The gateway mints a
  # Google ID token per request and calls these Cloud Run services directly, so
  # the gateway's runtime service account needs roles/run.invoker on each. These
  # are exactly the backend services EXCEPT the gateway itself (a gateway does
  # not invoke itself). The service NAMES here are Cloud Run resource names
  # (already suffixed with -${environment} inside the cloud-run module).
  gateway_invokable_services = {
    for name, cfg in local.backend_services : name => cfg
    if name != "api-gateway"
  }
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
# Module: Cloud Run Services (8 services via for_each)
# ============================================================

module "cloud_run" {
  source   = "../../modules/cloud-run"
  for_each = local.all_services

  project_id     = var.project_id
  region         = var.region
  environment    = var.environment
  service_name   = each.key
  container_port = each.value.port
  memory         = each.value.memory
  cpu            = each.value.cpu
  ingress        = each.value.ingress
  is_public      = each.value.is_public

  # Startup probe must hit a LIVENESS path. Backend services expose
  # /health/live (no dependency checks); the gateway and frontend only serve
  # /health (a plain 200). Never probe the backend /health (readiness → 503
  # when the DB is briefly unreachable, which would fail startup).
  startup_probe_path = contains(["api-gateway", "frontend"], each.key) ? "/health" : "/health/live"

  # VPC Connector — only for backend services that need DB access
  vpc_connector = each.value.needs_vpc ? module.networking.vpc_connector_id : null

  # Service Account — backend uses erp-backend, frontend uses erp-frontend
  service_account_email = (
    each.key == "frontend"
    ? module.iam.frontend_sa_email
    : module.iam.backend_sa_email
  )

  # Container image from Artifact Registry
  image = "${var.region}-docker.pkg.dev/${var.project_id}/${module.registry.repository_id}/${each.key}:latest"

  # Secret references
  secret_env_vars = each.key == "frontend" ? {} : {
    DATABASE_URL             = module.secrets.database_url_secret_id
    DIRECT_URL               = module.secrets.database_direct_url_secret_id
    JWT_SECRET               = module.secrets.jwt_secret_id
    UPSTASH_REDIS_REST_URL   = module.secrets.upstash_redis_url_secret_id
    UPSTASH_REDIS_REST_TOKEN = module.secrets.upstash_redis_token_secret_id
  }

  # Plain env vars (no self-references to avoid cycle)
  env_vars = merge(
    { NODE_ENV = "production" },
    each.key != "frontend" ? {
      PUBSUB_PROJECT_ID = var.project_id
    } : {}
  )

  depends_on = [
    module.networking,
    module.secrets,
    module.iam,
    module.registry,
  ]
}

# ============================================================
# Service-to-Service Auth: Gateway → private services
# ============================================================
# The api-gateway proxies /api/* and /docs/*-json to the private (internal
# ingress, no allUsers invoker) backend services. On Cloud Run it authenticates
# with a Google ID token minted from its runtime service account (erp-backend-
# <env>, i.e. module.iam.backend_sa_email — backend services share this SA).
# Grant that SA roles/run.invoker on each private service so the calls are
# authorized. Bound at the service resource level (not project-wide) so invoke
# permission is explicit and scoped to just the six proxied services.
resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  for_each = local.gateway_invokable_services

  project  = var.project_id
  location = var.region
  name     = module.cloud_run[each.key].service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${module.iam.backend_sa_email}"

  depends_on = [module.cloud_run]
}

# ============================================================
# Post-deploy: Inject service URLs into Gateway & Frontend
# Cloud Run URLs aren't known until after creation → can't be
# in the for_each block without creating a cycle.
# ============================================================

resource "null_resource" "gateway_env_vars" {
  triggers = {
    # Re-run if the gateway OR any downstream service URL changes (not just the
    # gateway's own URL — otherwise a rebuilt downstream service would leave the
    # gateway pointing at a stale URL).
    gateway_url    = module.cloud_run["api-gateway"].service_url
    auth_url       = module.cloud_run["auth-service"].service_url
    customer_url   = module.cloud_run["customer-service"].service_url
    order_url      = module.cloud_run["sales-service"].service_url
    inventory_url  = module.cloud_run["inventory-service"].service_url
    catalog_url    = module.cloud_run["catalog-service"].service_url
    purchasing_url = module.cloud_run["purchasing-service"].service_url
  }

  provisioner "local-exec" {
    interpreter = ["powershell", "-Command"]
    # gcloud's --update-env-vars uses ',' as its KEY=VALUE delimiter by default.
    # On Windows PowerShell a bare ',' in the command string is parsed as the
    # array operator, which splits the list and collapses EVERY value into the
    # first var (AUTH_SERVICE_URL, space-joined) — breaking gateway routing
    # (Invalid URL → 503). Use gcloud's custom-delimiter syntax (leading `^@^`)
    # so '@' delimits the pairs and no comma ever reaches PowerShell.
    command = "gcloud run services update ${module.cloud_run["api-gateway"].service_name} --region=${var.region} --update-env-vars=\"^@^AUTH_SERVICE_URL=${module.cloud_run["auth-service"].service_url}@CUSTOMER_SERVICE_URL=${module.cloud_run["customer-service"].service_url}@ORDER_SERVICE_URL=${module.cloud_run["sales-service"].service_url}@INVENTORY_SERVICE_URL=${module.cloud_run["inventory-service"].service_url}@CATALOG_SERVICE_URL=${module.cloud_run["catalog-service"].service_url}@PURCHASING_SERVICE_URL=${module.cloud_run["purchasing-service"].service_url}\" --quiet"
  }

  depends_on = [module.cloud_run]
}

# NOTE: the former `null_resource.frontend_env_vars` was removed — it set
# NEXT_PUBLIC_API_URL as a RUNTIME env var, which is a no-op: NEXT_PUBLIC_*
# values are inlined into the client bundle at build time, and the app reads
# NEXT_PUBLIC_API_GATEWAY (not _API_URL). The gateway URL must instead be passed
# as --build-arg NEXT_PUBLIC_API_GATEWAY in ci-frontend.yml.

