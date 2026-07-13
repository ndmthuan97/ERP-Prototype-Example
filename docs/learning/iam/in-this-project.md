---
type: Reference
title: "IAM in This Project"
description: "Mapping IAM → module iam trong ERP Prototype: 3 service account (backend/frontend/deployer) + role bindings và nguyên tắc least privilege"
tags: [iam, service-account, terraform, erp, gcp, least-privilege]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/iam/main.tf"
---

# IAM in This Project

> Mapping từ lý thuyết IAM sang Terraform thật. Ba SA, mỗi cái một vai trò rõ ràng.

> Liên quan: [Cloud Run](../cloud-run/in-this-project.md) · [Secret Manager](../secret-manager/in-this-project.md) · [Workload Identity Federation](../workload-identity-federation/in-this-project.md)

---

## 1. Ba Service Account

Source: [`infra/modules/iam/main.tf`](../../infra/modules/iam/main.tf)

```
erp-backend-<env>    → runtime cho 6 backend + api-gateway  (chạm DB, Pub/Sub, secret)
erp-frontend-<env>   → runtime cho frontend (không quyền đặc biệt)
erp-deployer-<env>   → CI/CD: Cloud Build + GitHub Actions deploy
```

## 2. Backend SA (runtime, dùng chung)

```hcl
resource "google_service_account" "backend" {
  account_id = "erp-backend-${var.environment}"
}
resource "google_project_iam_member" "backend_roles" {
  for_each = toset([
    "roles/cloudsql.client",     # kết nối Cloud SQL
    "roles/pubsub.publisher",    # publish event
    "roles/pubsub.subscriber",   # consume event
    "roles/run.invoker",         # gateway gọi backend khác
  ])
  role   = each.value
  member = "serviceAccount:${google_service_account.backend.email}"
}
```

| Role | Vì sao backend cần |
|---|---|
| `roles/cloudsql.client` | Mở kết nối Cloud SQL ([Cloud SQL doc](../cloud-sql/index.md)) |
| `roles/pubsub.publisher` | Bắn event (`sales-order.confirmed`...) |
| `roles/pubsub.subscriber` | Nhận event từ subscription |
| `roles/run.invoker` | api-gateway (chung SA) gọi 6 backend private |

> [!IMPORTANT]
> **`roles/secretmanager.secretAccessor` CỐ Ý không cấp ở đây.** Cấp project-wide = backend đọc *mọi* secret. Thay vào đó bind **per-secret** trong module `secrets` → backend chỉ đọc đúng 5 secret ERP. Ví dụ giáo khoa của **least privilege** (chọn cấp resource thay cấp project — xem [IAM on GCP §4](./on-gcp.md)). Chi tiết: [Secret Manager in This Project](../secret-manager/in-this-project.md).

## 3. Frontend SA (runtime, không quyền)

```hcl
resource "google_service_account" "frontend" {
  account_id = "erp-frontend-${var.environment}"
}
```

Cố tình **không** role nào — frontend chỉ phục vụ HTTP, không chạm DB/secret/Pub/Sub. *Không quyền là quyền đúng.*

## 4. Deployer SA (CI/CD — quyền cao nhất)

```hcl
resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/run.admin",                 # deploy Cloud Run
    "roles/artifactregistry.writer",   # push image
    "roles/iam.serviceAccountUser",    # actAs runtime SA + build SA
    "roles/cloudbuild.builds.editor",  # chạy build
    "roles/storage.admin",             # bucket artifact
    "roles/clouddeploy.releaser",      # tạo release Cloud Deploy
    "roles/clouddeploy.jobRunner",     # execution SA render+deploy
  ])
  role   = each.value
  member = "serviceAccount:${google_service_account.deployer.email}"
}
```

| Role | Vì sao deployer cần |
|---|---|
| `roles/run.admin` | Deploy/cập nhật Cloud Run service |
| `roles/artifactregistry.writer` | Push Docker image ([Artifact Registry](../artifact-registry/index.md)) |
| `roles/iam.serviceAccountUser` | **actAs**: deploy service chạy dưới runtime SA (xem [Core Concepts §6](./core-concepts.md)) |
| `roles/cloudbuild.builds.editor` | Kích hoạt Cloud Build |
| `roles/storage.admin` | Bucket lưu build artifact |
| `roles/clouddeploy.releaser` | `gcloud deploy releases create` |
| `roles/clouddeploy.jobRunner` | Cloud Deploy dùng deployer làm execution SA |

> [!NOTE]
> Deployer gần như admin pipeline → **tuyệt đối không** cấp key JSON tĩnh. GitHub Actions *impersonate* nó qua **Workload Identity Federation** (keyless). `deployer_sa_id` được output ra để module WIF gắn `roles/iam.workloadIdentityUser`. Xem [WIF in This Project](../workload-identity-federation/in-this-project.md).

## 5. Bức tranh phân quyền tổng thể

```
allUsers ─(run.invoker)→ api-gateway-dev, frontend-dev            [public]
erp-backend-dev ─(run.invoker, scoped)→ 6 backend private          [gateway→backend]
erp-backend-dev ─(cloudsql.client)→ Cloud SQL
erp-backend-dev ─(pubsub.*)→ Pub/Sub topics/subs
erp-backend-dev ─(secretAccessor, PER-SECRET)→ 5 ERP secrets       [least privilege]
erp-deployer-dev ─(admin roles)→ Cloud Run / Registry / Cloud Deploy
GitHub Actions ─(WIF, impersonate)→ erp-deployer-dev               [keyless]
```

> [!NOTE]
> Binding invoker cho các Cloud Run service (`allUsers` cho gateway+frontend; `erp-backend-dev` cho 6 backend) hiện khai **thẳng trong root `main.tf`** (không qua module iam), vì service do Cloud Deploy sở hữu — xem [Cloud Run in This Project](../cloud-run/in-this-project.md).

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Workload Identity Federation](../workload-identity-federation/index.md) · [Secret Manager](../secret-manager/index.md) · [Cloud Run](../cloud-run/index.md)
