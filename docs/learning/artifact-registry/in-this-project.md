---
type: Reference
title: "Artifact Registry in This Project"
description: "Mapping Artifact Registry → module registry trong ERP Prototype: repo erp-services + cleanup keep 20 cho rollback, vị trí trong pipeline"
tags: [artifact-registry, terraform, erp, gcp, docker, ci-cd]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/registry/main.tf"
---

# Artifact Registry in This Project

> Mapping từ lý thuyết Artifact Registry sang Terraform thật. Module `registry` = một repository Docker.

> Liên quan: [Cloud Run](../cloud-run/in-this-project.md) · [IAM & Service Accounts](../iam/in-this-project.md) · [Workload Identity Federation](../workload-identity-federation/in-this-project.md)

---

## 1. Một repository

Source: [`infra/modules/registry/main.tf`](../../infra/modules/registry/main.tf)

```hcl
resource "google_artifact_registry_repository" "erp" {
  repository_id = "erp-services"
  location      = var.region          # us-central1 — cùng region Cloud Run
  format        = "DOCKER"
  description   = "Docker images for ERP Prototype services"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 20                  # giữ 20 version gần nhất mỗi image
    }
  }
}
```

| Field | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| `repository_id` | `erp-services` | Một repo dùng chung cho 8 service (mỗi service = 1 image) |
| `location` | `us-central1` | **Cùng region Cloud Run** → pull nhanh, tránh egress |
| `format` | `DOCKER` | Chứa container image |
| `cleanup_policies.action` | `KEEP` | Chỉ giữ số version chỉ định |
| `keep_count` | `20` | Giữ 20 version gần nhất |

## 2. Vì sao 20, không phải 5

> [!IMPORTANT]
> Rollback (qua `deploy.yml`) trỏ về một **commit SHA cũ** → image của SHA đó phải **còn** trong registry. `keep_count = 5` từng quá gắt: vài lần merge là đủ GC mất SHA cần roll back tới. **20** cho biên rollback an toàn hơn. Đây là ví dụ cleanup policy phải khớp **chiến lược rollback**, không chọn số bừa. Xem [Core Concepts §6](./core-concepts.md).

## 3. Image path đầy đủ

Từ output root module:

```
us-central1-docker.pkg.dev/<project_id>/erp-services/<service>:<sha>
```

## 4. Vị trí trong pipeline

```
GitHub Actions (WIF → impersonate deployer SA)
   │  docker build + push  (deployer có artifactregistry.writer)
   ▼
Artifact Registry: erp-services/<service>:<sha>     ← giữ 20 version gần nhất
   │  Cloud Deploy release trỏ image theo SHA
   ▼
Cloud Run pull image (cùng region → nhanh, không egress)
```

| Vai trò | Ai | Quyền |
|---|---|---|
| Push | deployer SA (CI/CD) | `roles/artifactregistry.writer` — xem [IAM](../iam/in-this-project.md) |
| Pull | Cloud Run service agent | Reader (mặc định trong project) |
| Auth CI | GitHub Actions | Qua WIF (keyless) — xem [WIF](../workload-identity-federation/in-this-project.md) |

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Cloud Run](../cloud-run/index.md) — tiêu thụ image (`var.image`)
- [IAM](../iam/index.md) · [Workload Identity Federation](../workload-identity-federation/index.md)
