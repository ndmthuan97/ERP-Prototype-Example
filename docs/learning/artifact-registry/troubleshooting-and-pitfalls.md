---
type: Reference
title: "Artifact Registry — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: cleanup GC mất image rollback, repo khác region, tag latest, thiếu quyền push/pull, dùng GCR deprecated"
tags: [artifact-registry, troubleshooting, pitfalls, docker, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/registry/main.tf"
---

# Artifact Registry — Troubleshooting & Pitfalls

> Tra cứu nhanh khi push/pull lỗi, rollback fail, hoặc hoá đơn tăng.

## 1. Push / Pull

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `denied: permission` khi push | Deployer thiếu `artifactregistry.writer` | Cấp writer cho deployer SA |
| `docker push` fail authentication | Chưa `gcloud auth configure-docker` / thiếu WIF token | Cấu hình credential helper; auth qua WIF |
| Cloud Run không pull được image | Service agent thiếu reader / repo khác project | Cấp reader; kiểm project/repo path |
| Pull chậm + phí egress | Repo khác region với Cloud Run | Đặt repo cùng region |

## 2. Rollback / Vòng đời image

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Rollback fail "image not found" | Cleanup GC mất SHA cũ (`keep_count` quá nhỏ) | Tăng `keep_count` khớp tần suất deploy (dự án: 20) |
| Deploy ra image sai/ngẫu nhiên | Dùng tag `:latest` di động | Tag theo commit SHA / dùng digest |
| Registry phình dung lượng | Không có cleanup policy | Thêm `cleanup_policies` |

## 3. Pitfalls đặc thù

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Vẫn push lên `gcr.io` | Dùng registry deprecated | Chuyển sang `*-docker.pkg.dev` |
| Một repo nhiều môi trường trộn lẫn | Khó phân biệt image dev/prod | Tách repo hoặc tag/prefix rõ theo môi trường |
| Đóng nhầm secret vào image | Ai pull được image = đọc secret | Không đóng secret vào image; dùng Secret Manager runtime |

## 4. Debug nhanh

```bash
# Liệt kê image trong repo
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/<project_id>/erp-services --project=<project_id>

# Xem các tag/digest của 1 image (kiểm SHA cần rollback còn không)
gcloud artifacts docker tags list \
  us-central1-docker.pkg.dev/<project_id>/erp-services/auth-service --project=<project_id>

# Kiểm IAM repo (ai push/pull được)
gcloud artifacts repositories get-iam-policy erp-services \
  --location=us-central1 --project=<project_id>
```

## Related Concepts

- [Artifact Registry in This Project](./in-this-project.md) — repo erp-services + keep 20
- [Core Concepts](./core-concepts.md) — tag/digest, cleanup, immutability
- [Artifact Registry on GCP](./on-gcp.md) — IAM, GCR deprecated
