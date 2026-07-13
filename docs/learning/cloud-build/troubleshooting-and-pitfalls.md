---
type: Reference
title: "Cloud Build — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: custom SA cần logging, thiếu releaser/actAs, substitutions sai, timeout, release name không hợp lệ, tuần tự thay vì song song"
tags: [cloud-build, troubleshooting, pitfalls, gcp, cloud-deploy, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://cloudbuild.yaml"
---

# Cloud Build — Troubleshooting & Pitfalls

> Tra cứu nhanh khi build fail hoặc release không tạo được.

## 1. Service account & logging

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Build fail: "logging must be ... when service_account is set" | Custom SA nhưng chưa khai logging | `options.logging: CLOUD_LOGGING_ONLY` (đã set trong dự án) |
| `releases create` permission denied | Build SA thiếu `clouddeploy.releaser` hoặc `actAs` execution SA | Chạy dưới deployer SA ([IAM](../iam/in-this-project.md)) |
| Không submit được build | GitHub Actions thiếu WIF / quyền | Auth qua WIF; `id-token: write` |

## 2. Config / substitutions

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Release tạo với tag sai | `_TAG` không truyền / sai | Truyền `--substitutions=_TAG=...` |
| `release name invalid` | Tên không khớp `^[a-z][a-z0-9-]*$` / >63 ký tự | deploy.yml sinh `rel-<sha12>-<epoch>` hợp lệ |
| Step chạy tuần tự (chậm) | Thiếu `waitFor: ['-']` | Thêm để 8 release song song |

## 3. Thời gian / tài nguyên

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Build timeout | Vượt `timeout: 1200s` | Tăng timeout; kiểm release nào treo |
| 2 release chồng nhau vào dev | Thiếu concurrency guard | `concurrency: deploy-dev` (deploy.yml) |

## 4. Ranh giới trách nhiệm (đặc thù dự án)

| Hiểu nhầm | Sự thật |
|---|---|
| "Cloud Build build image" | Image build ở **GitHub Actions** (`docker build`); Cloud Build chỉ tạo release |
| "Rollback bằng cách submit lại build" | Rollback dùng **thẳng Cloud Deploy** (rollout trước) |
| "Dùng Cloud Build SA mặc định" | Dự án chạy dưới **deployer SA** (cần releaser + actAs) |

## 5. Debug nhanh

```bash
# Xem build gần đây + log
gcloud builds list --project=<project> --limit=5
gcloud builds log <BUILD_ID> --project=<project>

# Submit thử tay (giống deploy.yml)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_TAG=latest,_RELEASE=rel-test-$(date +%s) \
  --service-account=projects/<project>/serviceAccounts/<deployer-sa> \
  --project=<project> .
```

## Related Concepts

- [Cloud Build in This Project](./in-this-project.md) — cloudbuild.yaml
- [Cloud Build on GCP](./on-gcp.md) — custom SA, logging
- [Cloud Deploy](../cloud-deploy/index.md) — bước sau (release → rollout)
