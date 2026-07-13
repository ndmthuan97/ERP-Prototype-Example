---
type: Reference
title: "Cloud Deploy — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: singular node (nhiều service/pipeline), execution SA thiếu quyền, rollback đúng cách, spec drift với Terraform, digest không ghim"
tags: [cloud-deploy, troubleshooting, pitfalls, gcp, skaffold, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://deploy/clouddeploy.yaml"
---

# Cloud Deploy — Troubleshooting & Pitfalls

> Tra cứu nhanh khi release/rollout fail hoặc rollback không đúng.

## 1. Release / Render

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `expected singular node ... but was N` | Nhồi nhiều service vào 1 pipeline (cloudrun deployer) | 1 pipeline / service (dự án: 8 pipeline) |
| Render fail | skaffold.yaml / service.yaml sai cú pháp | Kiểm manifest; `gcloud deploy releases create` xem log |
| Image không ghim digest đúng | Tag `:latest` đổi giữa build và release | Render resolve digest lúc tạo release (đúng theo thiết kế) |

## 2. Rollout / quyền

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Rollout fail: permission denied | Execution SA thiếu `clouddeploy.jobRunner` / `run.admin` / `actAs` | Cấp role cho deployer SA ([IAM](../iam/in-this-project.md)) |
| Release tạo được nhưng không rollout | Target/pipeline chưa apply | `gcloud deploy apply --file=deploy/clouddeploy.yaml` |
| Service không cập nhật sau release | Nhầm pipeline/target | Kiểm `--delivery-pipeline` đúng `erp-<service>` |

## 3. Rollback

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Rollback không thấy bản cũ | Image release cũ đã bị GC | Tăng `keep_count` ([Artifact Registry](../artifact-registry/in-this-project.md)) |
| Rollback nhầm bằng deploy.yml | Chạy release mới thay vì quay lại | Dùng **thẳng Cloud Deploy** (rollout/release trước) — xem `deploy/MIGRATION.md` |

## 4. Drift & bàn giao (đặc thù dự án)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Sửa spec service trong Terraform | Không ăn — spec ở `deploy/*/service.yaml` | Sửa `service.yaml`, không sửa module cloud-run |
| Quên `terraform state rm module.cloud_run` khi bàn giao | `apply` báo "8 to destroy" | Chạy `state rm` trước ([Cloud Run §0](../cloud-run/in-this-project.md)) |
| Đổi pipeline/target nhưng không apply lại | Cloud Deploy dùng định nghĩa cũ | `gcloud deploy apply` sau mỗi thay đổi |

## 5. Debug nhanh

```bash
# Liệt kê pipeline + release + rollout
gcloud deploy delivery-pipelines list --region=us-central1 --project=<project>
gcloud deploy releases list --delivery-pipeline=erp-auth-service --region=us-central1 --project=<project>
gcloud deploy rollouts list --release=<rel> --delivery-pipeline=erp-auth-service --region=us-central1 --project=<project>
```

## Related Concepts

- [Cloud Deploy in This Project](./in-this-project.md) — 8 pipeline + target dev
- [Core Concepts](./core-concepts.md) — render, rollout, rollback
- [Cloud Run in This Project](../cloud-run/in-this-project.md) — spec drift
