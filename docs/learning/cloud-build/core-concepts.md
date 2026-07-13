---
type: Concept Explanation
title: "Cloud Build Core Concepts"
description: "Building blocks: Build config, Steps, Builder image, Substitutions, waitFor (parallel/serial), Timeout, Logging options, Artifacts, Triggers"
tags: [cloud-build, steps, substitutions, waitfor, builder-image, triggers]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Build Core Concepts

## Định nghĩa

Cloud Build xây trên vài khái niệm cốt lõi. Nắm chúng = đọc/viết `cloudbuild.yaml`, chạy song song, truyền biến.

## Tại sao quan trọng

Không hiểu `waitFor` → step chạy tuần tự chậm. Không hiểu substitutions → hardcode giá trị. Không hiểu builder image → không biết mỗi step chạy trong container nào.

## Cách hoạt động

### 1. Build config (`cloudbuild.yaml`)

File YAML mô tả pipeline: `steps`, `substitutions`, `timeout`, `options`.

```yaml
steps:
  - id: my-step
    name: 'gcr.io/cloud-builders/gcloud'   # builder image
    args: ['run', 'deploy', ...]
substitutions:
  _TAG: latest
timeout: '1200s'
options:
  logging: CLOUD_LOGGING_ONLY
```

### 2. Steps — mỗi step là 1 container

Mỗi step chạy một **container** (builder image) thực thi lệnh. Các step **chia sẻ** workspace `/workspace` (source được mount).

### 3. Builder image (`name`)

Image chứa công cụ cho step: `gcloud` (cloud-sdk), `docker`, `node`, hoặc image bất kỳ.

```yaml
name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'   # có gcloud
entrypoint: gcloud
args: [deploy, releases, create, ...]
```

### 4. Substitutions — biến truyền vào

Biến `${_NAME}` (user-defined, prefix `_`) hoặc built-in (`$PROJECT_ID`, `$COMMIT_SHA`). Truyền lúc submit qua `--substitutions`.

```yaml
substitutions: { _TAG: latest, _RELEASE: rel-manual }
# override: gcloud builds submit --substitutions=_TAG=abc123,_RELEASE=rel-x
```

### 5. `waitFor` — song song hay tuần tự

Điều khiển thứ tự step:

| `waitFor` | Nghĩa |
|---|---|
| Không set | Chờ step trước đó (tuần tự) |
| `['-']` | Không chờ gì → **chạy ngay** (song song) |
| `['step-id']` | Chờ step cụ thể xong |

```yaml
- id: a
  waitFor: ['-']     # a và b chạy SONG SONG (đều không chờ)
- id: b
  waitFor: ['-']
```

> [!TIP]
> `waitFor: ['-']` cho mọi step độc lập → fan-out song song. Dự án dùng để tạo 8 release cùng lúc thay vì lần lượt.

### 6. Timeout

Giới hạn tổng thời gian build (dự án: `1200s` = 20 phút). Quá → build fail.

### 7. Logging options

Nơi ghi log. `CLOUD_LOGGING_ONLY` gửi log vào Cloud Logging (bắt buộc khi dùng **custom service account** — xem [on-gcp](./on-gcp.md)).

### 8. Artifacts & images

Build có thể khai `images:` (tự push sau khi xong) hoặc `artifacts:` (upload bucket). Dự án không dùng (image build ở GitHub Actions).

### 9. Triggers vs manual submit

| Cách chạy | Khi nào |
|---|---|
| **Trigger** (push/PR/tag) | Cloud Build tự chạy khi có sự kiện repo |
| **Manual submit** (`gcloud builds submit`) | Ai đó/CI chủ động submit (dự án: deploy.yml submit) |

## Ví dụ thực tế

```yaml
steps:
  - id: release-auth
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    waitFor: ['-']                       # song song
    args: [deploy, releases, create, '${_RELEASE}',
           --delivery-pipeline=erp-auth-service, --region=us-central1,
           --source=deploy/auth-service,
           '--images=auth-service=...:${_TAG}']
  # ... 7 step nữa, tất cả waitFor ['-']
substitutions: { _TAG: latest, _RELEASE: rel-manual }
timeout: '1200s'
options: { logging: CLOUD_LOGGING_ONLY }
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Step chạy tuần tự (chậm) | Quên `waitFor: ['-']` | Thêm để chạy song song |
| Build fail vì thiếu log config | Custom SA cần logging rõ ràng | `options.logging: CLOUD_LOGGING_ONLY` |
| Giá trị hardcode | Không dùng substitutions | Dùng `${_VAR}` + `--substitutions` |
| Build timeout | Vượt `timeout` | Tăng timeout hoặc tối ưu step |

## Related Concepts

- [Overview](./overview.md) — vai trò trong ERP
- [Cloud Build on GCP](./on-gcp.md) — SA, logging, triggers
- [Cloud Build in This Project](./in-this-project.md) — cloudbuild.yaml 8 step
