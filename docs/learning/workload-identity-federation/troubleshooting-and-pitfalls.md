---
type: Reference
title: "WIF — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: condition lỏng cho repo lạ, fork PR deploy được, sai github_repo, vẫn tạo key JSON, auth fail, thiếu impersonation"
tags: [wif, troubleshooting, pitfalls, security, github-actions, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/workload-identity/main.tf"
---

# WIF — Troubleshooting & Pitfalls

> Tra cứu nhanh khi CI không auth được, hoặc audit bảo mật liên kết danh tính.

## 1. Bảo mật (nghiêm trọng nhất)

| Bẫy | Hệ quả | Xử lý |
|---|---|---|
| Thiếu / lỏng `attribute_condition` | **Repo GitHub bất kỳ** impersonate deployer SA | Luôn khoá `repository`; prod thêm `ref` |
| Chỉ khoá `repository`, không khoá branch | Fork PR / branch lạ deploy được | `&& assertion.ref == 'refs/heads/main'` |
| Vẫn tạo SA key JSON "cho chắc" | Mất lợi ích keyless + thêm bề mặt tấn công | Xoá key; chỉ dùng WIF |
| Cấp `workloadIdentityUser` cho cả pool | principalSet quá rộng | Scope theo `attribute.repository` |

## 2. Auth fail

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `unauthorized_client` / verify fail | Sai `issuer_uri` hoặc mapping | Dùng đúng issuer GitHub; kiểm `attribute_mapping` |
| Condition không khớp → từ chối | Sai định dạng `github_repo` (`owner/repo`) | Sửa `var.github_repo` đúng dạng |
| Auth OK nhưng `permission denied` khi deploy | principalSet chưa impersonate / deployer thiếu role | Kiểm binding `workloadIdentityUser` + role deployer ([IAM](../iam/troubleshooting-and-pitfalls.md)) |
| `invalid_target` | provider/pool name sai trong workflow | Dùng đúng `provider_name` (output module) |

## 3. Cấu hình GitHub Actions (phía workflow)

| Bẫy | Hệ quả | Xử lý |
|---|---|---|
| Quên `permissions: id-token: write` | GitHub không phát token OIDC | Thêm vào job/workflow |
| Sai `workload_identity_provider` | Auth fail | Dùng output `provider_name` đầy đủ |
| Thiếu `service_account` để impersonate | Không mượn được deployer | Đặt `service_account = deployer_sa_email` |

## 4. Debug nhanh

```bash
# Xem pool & provider
gcloud iam workload-identity-pools describe github-pool-<env> \
  --location=global --project=<project_id>
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github-pool-<env> --project=<project_id>

# Kiểm ai được impersonate deployer SA (binding workloadIdentityUser)
gcloud iam service-accounts get-iam-policy \
  erp-deployer-<env>@<project_id>.iam.gserviceaccount.com --project=<project_id>
```

## 5. Checklist an toàn

- [ ] `attribute_condition` khoá `repository`
- [ ] Prod: thêm khoá `ref`/branch (chặn fork PR)
- [ ] **Không** tồn tại SA key JSON nào cho CI
- [ ] `principalSet` scope theo attribute, không cả pool
- [ ] Workflow có `permissions: id-token: write`

## Related Concepts

- [WIF in This Project](./in-this-project.md) — pool + provider + binding
- [Core Concepts](./core-concepts.md) — attribute condition, principalSet
- [WIF on GCP](./on-gcp.md) — siết repo/branch
