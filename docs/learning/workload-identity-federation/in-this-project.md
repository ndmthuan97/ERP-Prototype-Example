---
type: Reference
title: "WIF in This Project"
description: "Mapping WIF → module workload-identity trong ERP Prototype: pool + OIDC provider + attribute condition + impersonation binding cho deployer SA"
tags: [wif, workload-identity-federation, terraform, erp, gcp, github-actions, ci-cd]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/workload-identity/main.tf"
---

# WIF in This Project

> Mapping từ lý thuyết WIF sang Terraform thật. Module `workload-identity` = pool + provider + binding impersonate deployer SA.

> Liên quan: [IAM & Service Accounts](../iam/in-this-project.md) · [Artifact Registry](../artifact-registry/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md)

---

## 1. Pool — vùng tin cậy

Source: [`infra/modules/workload-identity/main.tf`](../../infra/modules/workload-identity/main.tf)

```hcl
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool-${var.environment}"
  display_name              = "GitHub Actions Pool (${var.environment})"
}
```

Vùng tin cậy cho danh tính đến từ GitHub Actions.

## 2. OIDC Provider — trái tim của WIF

```hcl
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_provider_id = "github-provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"   # ⭐ rào chắn

  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }    # tin GitHub
}
```

| Field | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| `issuer_uri` | GitHub Actions OIDC | GCP tin token do GitHub phát |
| `attribute_mapping` | sub/actor/repository | Kéo claim → thuộc tính GCP (lọc & audit) |
| `attribute_condition` | `repository == '<owner/repo>'` | **Chỉ** run từ đúng repo mới lấy được quyền |

> [!WARNING]
> `attribute_condition` là **dòng phòng thủ sống còn**. Thiếu/lỏng → mọi repo GitHub impersonate được deployer SA. Điều kiện `repository == 'owner/repo'` khoá về đúng 1 repo. **Prod nên siết thêm branch** (`&& assertion.ref == 'refs/heads/main'`) để PR từ fork không deploy được. Xem [on-gcp §3](./on-gcp.md).

## 3. Impersonation Binding

```hcl
resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = var.deployer_sa_id                       # từ module iam
  role               = "roles/iam.workloadIdentityUser"
  member = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}
```

| Thành phần | Ý nghĩa |
|---|---|
| `service_account_id` | Deployer SA (`erp-deployer-<env>`) — danh tính GitHub mượn |
| `role` | `roles/iam.workloadIdentityUser` — quyền "đóng vai" SA |
| `member` `principalSet://...attribute.repository/<repo>` | Mọi workflow run từ repo đó = thành viên được impersonate |

> Mắt xích khép kín với [IAM](../iam/in-this-project.md): module iam **output** `deployer_sa_id`; module này **tiêu thụ** để gắn quyền impersonate. Deployer có sẵn role admin (run/registry/deploy) → GitHub mượn danh tính deployer là đủ quyền deploy.

## 4. Luồng end-to-end

```
1. Job GitHub Actions chạy trên repo owner/repo
2. GitHub phát token OIDC ngắn hạn { repository: "owner/repo", actor, sub, ... }
3. Job gọi google-github-actions/auth với pool + provider (output provider_name)
4. GCP verify: issuer GitHub? attribute_condition (repository == owner/repo) đạt?
5. Đạt → cấp token deployer SA (impersonation, tạm)
6. Job: docker push (Artifact Registry) + gcloud deploy releases create
7. Token hết hạn sau ít phút — KHÔNG có key nào tồn tại lâu dài
```

## 5. Output — dùng trong GitHub Actions

| Output | Dùng cho |
|---|---|
| `provider_name` | `google-github-actions/auth` (`workload_identity_provider`) |
| `deployer_sa_email` (từ module iam) | `service_account` để impersonate |

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [IAM & Service Accounts](../iam/index.md) · [Artifact Registry](../artifact-registry/index.md) · [Cloud Run](../cloud-run/index.md)
