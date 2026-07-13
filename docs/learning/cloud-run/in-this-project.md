---
type: Reference
title: "Cloud Run in This Project"
description: "Mapping Cloud Run → module cloud-run trong ERP Prototype. LƯU Ý drift: spec service đã dời sang Google Cloud Deploy; Terraform chỉ còn giữ IAM."
tags: [cloud-run, terraform, erp, gcp, cloud-deploy]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/cloud-run/main.tf"
---

# Cloud Run in This Project

> Mapping từ lý thuyết Cloud Run sang Terraform thực tế. Mỗi resource trong module `cloud-run` được giải thích từng phần.

> Liên quan: [IAM & Service Accounts](../iam/in-this-project.md) · [Secret Manager](../secret-manager/in-this-project.md) · [VPC in This Project](../vpc/vpc-in-this-project.md)

---

## 0. ⚠️ Đọc trước: Terraform KHÔNG còn tạo service Cloud Run

Đây là điểm **docs dễ lệch code nhất** — sự thật hiện tại (`infra/environments/dev/main.tf`):

- Module `cloud-run` **vẫn còn** trong `infra/modules/cloud-run/` nhưng **không còn được root module gọi**. Trước đây `module.cloud_run` (`for_each` 8 service) tạo `google_cloud_run_v2_service`.
- Kể từ khi chuyển sang **Google Cloud Deploy**, nguồn sự thật của spec service (port/memory/env/secret/VPC/probe) là các manifest `deploy/manifests/*.yaml` (render qua `deploy/skaffold.yaml`).
- Terraform giờ **chỉ** giữ: (1) nền tảng (VPC/DB/secret/SA/registry/WIF), (2) **IAM binding cấp service** (ai được `invoke`).

> [!WARNING]
> Khi bàn giao state (1 lần, trước `apply` đầu tiên sau thay đổi): `terraform state rm 'module.cloud_run'` và `terraform state rm 'null_resource.gateway_env_vars'` — gỡ service khỏi state mà **không** destroy. Bỏ bước này → `apply` báo "8 to destroy" → **DỪNG, đừng approve**. Chi tiết: `deploy/MIGRATION.md`.

Doc vẫn giải thích code module vì nó là bản mô tả rõ nhất cách 1 service Cloud Run được cấu hình — và manifest Cloud Deploy ánh xạ 1-1 với chính các field này.

---

## 1. 8 Service của ERP

```
Public (ingress=all):        api-gateway-dev, frontend-dev
Backend (internal-only):     auth, customer, sales, inventory, catalog, purchasing (-dev)
```

Gateway nhận request internet → mint ID token → gọi 6 backend private. Frontend phục vụ UI.

## 2. Terraform Code — Giải thích từng phần

Source: [`infra/modules/cloud-run/main.tf`](../../infra/modules/cloud-run/main.tf)

### Service + scaling

```hcl
resource "google_cloud_run_v2_service" "service" {
  name    = "${var.service_name}-${var.environment}"    # auth-service-dev
  ingress = var.ingress == "all" ? "INGRESS_TRAFFIC_ALL" : "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = false

  template {
    service_account = var.service_account_email          # runtime SA
    scaling {
      min_instance_count = 0                              # scale-to-zero
      max_instance_count = var.max_instances
    }
    ...
    max_instance_request_concurrency = var.concurrency
    timeout                          = "300s"
  }
}
```

| Field | Ý nghĩa (xem [Core Concepts](./core-concepts.md) / [on-gcp](./on-gcp.md)) |
|---|---|
| `ingress` | Public (`all`) cho gateway+frontend; `internal-only` cho 6 backend |
| `service_account` | Runtime SA — quyết định quyền (xem [IAM](../iam/in-this-project.md)) |
| `min_instance_count = 0` | Scale-to-zero → $0 khi idle, đánh đổi cold start |
| `concurrency` / `timeout` | Số request/instance; cắt request sau 300s |

### VPC Access (dynamic block)

```hcl
dynamic "vpc_access" {
  for_each = var.vpc_connector != null ? [1] : []    # chỉ backend cần DB
  content {
    connector = var.vpc_connector
    egress    = "PRIVATE_RANGES_ONLY"
  }
}
```

Chỉ backend chạm Cloud SQL mới gắn connector; frontend không → tiết kiệm. Xem [VPC in This Project](../vpc/vpc-in-this-project.md).

### Env vars — 2 loại

```hcl
dynamic "env" {                       # (a) plain
  for_each = var.env_vars
  content { name = env.key, value = env.value }
}
dynamic "env" {                       # (b) secret từ Secret Manager
  for_each = var.secret_env_vars
  content {
    name = env.key
    value_source { secret_key_ref { secret = env.value, version = "latest" } }
  }
}
```

> [!IMPORTANT]
> `DATABASE_URL`, `JWT_SECRET`... **không bao giờ** là plain env hay nằm trong image — inject từ Secret Manager qua `secret_key_ref` lúc runtime. Runtime SA phải có `secretAccessor` trên đúng secret. Xem [Secret Manager](../secret-manager/in-this-project.md).

### Startup probe + lifecycle

```hcl
startup_probe {
  http_get { path = var.startup_probe_path, port = var.container_port }
  initial_delay_seconds = 5, period_seconds = 10, failure_threshold = 3
}
lifecycle { ignore_changes = [ template[0].containers[0].image ] }
```

> [!NOTE]
> `ignore_changes` image: image do CI/CD (Cloud Build → Cloud Deploy) cập nhật, **không** phải Terraform. Không bỏ qua → mỗi `apply` cố rollback image cũ, phá deploy. Ranh giới: **Terraform lo hạ tầng, pipeline lo image** — nguyên tắc này bị đẩy xa hơn khi cả spec dời sang Cloud Deploy (mục 0).

### IAM invoker (trong root main.tf, không qua module)

```hcl
# Public: allUsers invoke gateway + frontend
resource "google_cloud_run_v2_service_iam_member" "public" {
  for_each = toset(["api-gateway", "frontend"])
  role = "roles/run.invoker", member = "allUsers"
}
# Gateway → 6 backend: runtime SA gateway (erp-backend-dev) invoke từng backend (scoped)
resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  for_each = toset([...6 backend...])
  role = "roles/run.invoker", member = "serviceAccount:${module.iam.backend_sa_email}"
}
```

Least privilege: 6 backend **không** public; chỉ SA gateway gọi được. Xem [IAM in This Project](../iam/in-this-project.md).

## 3. Luồng deploy hiện tại

```
GitHub Actions (WIF) → Cloud Build (build+push image) → Cloud Deploy (render manifest → rollout)
Terraform: chỉ apply nền tảng + IAM binding (không đụng spec/image)
```

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [IAM & Service Accounts](../iam/index.md) · [Secret Manager](../secret-manager/index.md) · [Artifact Registry](../artifact-registry/index.md)
