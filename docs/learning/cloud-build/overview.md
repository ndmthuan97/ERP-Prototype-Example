---
type: Learning Note
title: "Cloud Build Overview"
description: "Cloud Build là gì, build vs orchestrate, so sánh với GitHub Actions, và cách ERP phân công: GitHub Actions build image, Cloud Build điều phối release"
tags: [learning, cloud-build, ci, ci-cd, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Build Overview

## Summary

**Google Cloud Build** = dịch vụ chạy **pipeline gồm nhiều step** (mỗi step là 1 container) managed. Thường dùng để build/test/push image, nhưng bản chất là "chạy chuỗi lệnh trong container trên hạ tầng Google". Trong ERP, nó được dùng làm **bộ điều phối CD**: tạo 8 Cloud Deploy release song song.

```
   Cloud Build = chạy N step (mỗi step 1 container) tuần tự hoặc song song
  ┌──────────────────────────────────────────────┐
  │ step1 (gcloud) │ step2 (gcloud) │ ... song song│
  │      ▼               ▼                          │
  │  tạo release    tạo release    (8 pipeline)     │
  └──────────────────────────────────────────────┘
```

## Key Concepts

### Cloud Build làm gì (tổng quát)

- Chạy **steps**: mỗi step là 1 container thực thi lệnh (build, test, `gcloud`, `docker`, `npm`...).
- Nhận input từ source (repo, bucket) + **substitutions** (biến).
- Output: image đẩy registry, artifact, hoặc side-effect (tạo release, apply infra...).

### Điểm đặc biệt trong ERP: Cloud Build KHÔNG build image

> [!IMPORTANT]
> Trái với thói quen "Cloud Build = build Docker image", trong dự án này **image được build bởi GitHub Actions** (`docker build` trong CI). Cloud Build chỉ đảm nhận **bước CD**: chạy 8 `gcloud deploy releases create` song song để tạo release cho [Cloud Deploy](../cloud-deploy/index.md). Lý do: gom bước tạo release (cần quyền `clouddeploy.releaser` + `actAs` execution SA) vào một nơi chạy dưới danh tính deployer SA.

### Phân công CI/CD trong ERP

```
GitHub Actions (CI)        Cloud Build (CD orchestrator)     Cloud Deploy (CD)
├── build+test (jest)      └── tạo 8 release song song  ────▶ render + rollout
├── docker build+push          (gcloud deploy releases                → Cloud Run
│   → Artifact Registry         create)
└── submit Cloud Build ─────────┘
```

### Cloud Build vs GitHub Actions

| | Cloud Build | GitHub Actions |
|---|---|---|
| Chạy ở | Hạ tầng Google (gần GCP) | Runner GitHub |
| Auth GCP | Native (SA) | Qua WIF |
| Trong ERP | Bước tạo release (gần Cloud Deploy) | Build/test/push image, orchestrate |
| Hợp cho | Việc cần quyền GCP + gần GCP | CI chung, matrix, path-filter |

> Cả hai cùng tồn tại: GitHub Actions lo CI + trigger; Cloud Build lo bước cần chạy dưới deployer SA sát Cloud Deploy.

### Vị trí trong kiến trúc ERP

```
deploy.yml (GitHub Actions) ─gcloud builds submit→ cloudbuild.yaml
   (chạy DƯỚI deployer SA)         │ 8 step song song
                                   ▼
                            Cloud Deploy: 8 release → rollout Cloud Run
```

## Practical Application

Dùng Cloud Build khi:
- Cần chạy bước CI/CD **dưới danh tính SA GCP** + gần dịch vụ GCP.
- Muốn fan-out nhiều thao tác `gcloud` song song (như tạo 8 release).
- (Thông thường) build + push image — dù ERP chọn GitHub Actions cho bước đó.

## References

- [Cloud Build Docs](https://cloud.google.com/build/docs) — tài liệu chính thức
- [Build config schema](https://cloud.google.com/build/docs/build-config-file-schema) — cú pháp cloudbuild.yaml
- [Cloud Build + Cloud Deploy](https://cloud.google.com/deploy/docs) — chuỗi CD

## Related Concepts

- [Core Concepts](./core-concepts.md) — steps, substitutions, parallel
- [Cloud Build on GCP](./on-gcp.md) — SA, logging, triggers
- [Cloud Build in This Project](./in-this-project.md) — cloudbuild.yaml
