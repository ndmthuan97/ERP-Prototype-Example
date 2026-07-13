---
type: Reference
title: "IAM — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: 403 Forbidden, thiếu actAs khi deploy, over-privilege, service agent thiếu quyền, SA key lộ, authoritative binding"
tags: [iam, troubleshooting, pitfalls, security, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/iam/main.tf"
---

# IAM — Troubleshooting & Pitfalls

> Tra cứu nhanh khi gặp lỗi quyền, deploy fail, hoặc audit bảo mật.

## 1. Lỗi quyền runtime

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `403 PERMISSION_DENIED` khi gọi Cloud Run | Caller thiếu `roles/run.invoker` | Cấp invoker cho đúng SA (hoặc `allUsers` nếu public) |
| Service crash lúc start: không đọc được secret | Runtime SA thiếu `secretmanager.secretAccessor` | Bind per-secret cho runtime SA ([Secret Manager](../secret-manager/in-this-project.md)) |
| Backend không nối được Cloud SQL | Thiếu `roles/cloudsql.client` | Cấp cho backend SA |
| Publish/consume Pub/Sub bị chặn | Thiếu `pubsub.publisher`/`subscriber` | Cấp role tương ứng |

## 2. Lỗi deploy / CI-CD

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Deploy fail "cannot act as service account" | Deployer thiếu `iam.serviceAccountUser` trên runtime SA | Cấp actAs (xem [Core Concepts §6](./core-concepts.md)) |
| CI push image fail | Deployer thiếu `artifactregistry.writer` | Cấp role writer |
| Cloud Deploy release fail | Thiếu `clouddeploy.releaser`/`jobRunner` | Cấp cả hai cho deployer |
| GitHub Actions không auth được | WIF chưa gắn `workloadIdentityUser` | Xem [WIF Troubleshooting](../workload-identity-federation/troubleshooting-and-pitfalls.md) |

## 3. Pitfalls bảo mật

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Cấp `roles/editor`/`owner` cho SA | Lộ service = mất gần cả project | Dùng predefined role hẹp |
| `secretAccessor` cấp project-wide | SA đọc mọi secret | Bind per-secret |
| Tạo SA key JSON | Bí mật dài hạn, lộ = toàn quyền SA | Dùng WIF, không key |
| Gộp mọi service 1 SA quyền cao | Blast radius lớn | Tách theo vai trò (backend/frontend/deployer) |
| `google_project_iam_binding` (authoritative) | Ghi đè, khoá mất member khác | Dùng `..._iam_member` |
| Tự chế custom role phức tạp | Khó audit, dễ sai | Ưu tiên predefined |

## 4. Bẫy service agent (đặc thù dự án)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Quên cấp quyền cho Pub/Sub service agent | Dead-lettering fail âm thầm | Giữ binding cho `service-<num>@gcp-sa-pubsub` ([Pub/Sub](../pubsub/in-this-project.md)) |

## 5. Cách debug quyền nhanh

```bash
# Xem policy cấp project
gcloud projects get-iam-policy <project_id> --format=json

# Xem SA có role gì (lọc theo member)
gcloud projects get-iam-policy <project_id> \
  --flatten="bindings[].members" \
  --filter="bindings.members:erp-backend-<env>@" \
  --format="table(bindings.role)"

# Xem policy 1 secret (kiểm per-secret accessor)
gcloud secrets get-iam-policy database-url-<env> --project=<project_id>
```

## Related Concepts

- [IAM in This Project](./in-this-project.md) — 3 SA + bindings
- [Core Concepts](./core-concepts.md) — actAs, authoritative vs non-authoritative
- [IAM on GCP](./on-gcp.md) — service agents, resource hierarchy
