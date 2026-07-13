---
type: Concept Explanation
title: "Cloud Deploy on GCP"
description: "Đặc thù GCP: Skaffold render cho Cloud Run (cloudrun deployer), execution config & service account, ghim image digest, ràng buộc 1 service/pipeline, verify/approval"
tags: [cloud-deploy, gcp, skaffold, execution-sa, digest, cloudrun-deployer]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Deploy on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách render, ai thực thi rollout, và các ràng buộc thực tế.

## Cách hoạt động

### 1. Skaffold render cho Cloud Run (`cloudrun` deployer)

Cloud Deploy dùng **Skaffold** để render manifest. Với đích Cloud Run, skaffold khai `deploy: cloudrun: {}` và trỏ tới manifest Knative `service.yaml`.

```yaml
# deploy/<service>/skaffold.yaml
apiVersion: skaffold/v4beta11
kind: Config
manifests:
  rawYaml: [service.yaml]
deploy:
  cloudrun: {}
```

### 2. Ràng buộc: 1 Cloud Run service / pipeline

> [!WARNING]
> Deployer `cloudrun` của Skaffold **chỉ nhận 1 Cloud Run service mỗi pipeline** (lỗi *"expected singular node ... but was 8"* nếu nhồi 8 service). Hệ quả kiến trúc: **mỗi microservice một Delivery Pipeline riêng**. Đây là lý do dự án có **8 pipeline** trỏ chung 1 target — xem [in-this-project](./in-this-project.md).

### 3. Ghim image digest lúc render

Release tạo với image tag (vd `:latest`), nhưng khi render Skaffold **resolve tag → digest** (`@sha256:...`) và **ghim lại**. Rollout dùng digest cố định → rollback **đúng bản** dù tag `:latest` sau đó đã trỏ image khác.

```
release images: ...:latest  ──render──▶  ...@sha256:abc...  (ghim)
→ rollback về release này = luôn đúng image đó
```

### 4. Execution Config & Service Account

Target khai **executionConfigs**: dùng SA nào để **RENDER** và **DEPLOY**.

```yaml
executionConfigs:
  - usages: [RENDER, DEPLOY]
    serviceAccount: erp-deployer-dev@<project>.iam.gserviceaccount.com
run:
  location: projects/<project>/locations/us-central1
```

> [!IMPORTANT]
> Execution SA (dự án: **deployer SA**) cần `roles/clouddeploy.jobRunner` (chạy job render/deploy) + quyền deploy Cloud Run (`run.admin`) + `actAs` runtime SA. Thiếu → rollout fail. Xem [IAM in This Project](../iam/in-this-project.md).

### 5. Verify & Approval (tuỳ chọn)

- **Verify**: chạy job kiểm thử sau deploy trước khi coi rollout thành công.
- **Required approval**: chặn promotion lên prod tới khi có người duyệt.

Dự án (dev) hiện không bật verify/approval — thêm khi có staging/prod.

### 6. Bootstrap / cập nhật pipeline

Pipeline + target khai trong `clouddeploy.yaml`, áp bằng:

```bash
gcloud deploy apply --file=deploy/clouddeploy.yaml --region=us-central1 --project=<project>
```

Chạy lại mỗi khi đổi định nghĩa pipeline/target.

## Ví dụ thực tế

```
Target dev: RENDER+DEPLOY bằng erp-deployer-dev, run @ us-central1
8 DeliveryPipeline (erp-<service>) → đều trỏ target dev
release: gcloud deploy releases create --delivery-pipeline=erp-auth-service \
  --source=deploy/auth-service --images=auth-service=...:latest
→ render ghim digest → rollout Cloud Run auth-service-dev
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `expected singular node ... but was N` | Nhồi nhiều service vào 1 pipeline | 1 pipeline / service |
| Rollout fail: permission denied | Execution SA thiếu jobRunner/run.admin/actAs | Cấp role cho deployer SA |
| Render fail | skaffold.yaml / service.yaml sai | Kiểm cú pháp manifest |
| Rollback không thấy bản cũ | Image release cũ bị GC | Tăng cleanup Artifact Registry |

## Related Concepts

- [Core Concepts](./core-concepts.md) — render, rollout, rollback
- [Cloud Deploy in This Project](./in-this-project.md) — 8 pipeline + target dev
- [IAM in This Project](../iam/in-this-project.md) — execution SA (deployer)
