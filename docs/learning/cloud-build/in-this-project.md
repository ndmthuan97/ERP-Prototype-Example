---
type: Reference
title: "Cloud Build in This Project"
description: "Mapping Cloud Build → cloudbuild.yaml trong ERP Prototype: 8 bước tạo Cloud Deploy release song song, submit bởi deploy.yml chạy dưới deployer SA"
tags: [cloud-build, terraform, erp, gcp, cloud-deploy, ci-cd]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://cloudbuild.yaml"
---

# Cloud Build in This Project

> Trong ERP, Cloud Build **không build image** — nó là **bước CD** tạo 8 Cloud Deploy release song song, được `deploy.yml` (GitHub Actions) submit và chạy dưới danh tính deployer SA.

> Liên quan: [Cloud Deploy](../cloud-deploy/in-this-project.md) · [IAM](../iam/in-this-project.md) · [Workload Identity Federation](../workload-identity-federation/in-this-project.md)

---

## 1. Vị trí trong pipeline tổng thể

```
GitHub Actions CI (ci-backend/frontend): build+test → docker build+push → Artifact Registry
        │ workflow_run (sau khi CI xong, nhánh main)
        ▼
GitHub Actions deploy.yml: gcloud builds submit --config=cloudbuild.yaml (dưới deployer SA)
        ▼
Cloud Build (cloudbuild.yaml): 8 step SONG SONG → gcloud deploy releases create
        ▼
Cloud Deploy: render + rollout → Cloud Run
```

## 2. `cloudbuild.yaml` — 8 bước tạo release song song

Source: [`cloudbuild.yaml`](../../cloudbuild.yaml)

```yaml
steps:
  - id: release-api-gateway
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    waitFor: ['-']                       # song song, không chờ
    args: [deploy, releases, create, '${_RELEASE}',
           --delivery-pipeline=erp-api-gateway, --region=us-central1,
           --source=deploy/api-gateway,
           '--images=api-gateway=us-central1-docker.pkg.dev/$PROJECT_ID/erp-services/api-gateway:${_TAG}']
  # ... 7 step nữa (auth, customer, sales, inventory, catalog, purchasing, frontend)

substitutions:
  _TAG: latest
  _RELEASE: rel-manual
timeout: '1200s'
options:
  logging: CLOUD_LOGGING_ONLY
```

| Thành phần | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| **8 step** | 1 release/service | Mỗi step tạo release cho pipeline `erp-<service>` |
| `waitFor: ['-']` | song song | Tất cả chạy cùng lúc → nhanh |
| `name` | cloud-sdk image | Có `gcloud deploy` |
| `--images` tag `_TAG` | mặc định `latest` | Cloud Deploy **render → ghim digest** ([Cloud Deploy](../cloud-deploy/in-this-project.md)) |
| `_RELEASE` | `rel-manual` (default) | deploy.yml override tên release duy nhất |
| `timeout` | `1200s` | 20 phút cho cả 8 release |
| `options.logging` | `CLOUD_LOGGING_ONLY` | **Bắt buộc** vì chạy dưới custom SA (deployer) |

> [!NOTE]
> Cùng tên release `_RELEASE` ở 8 pipeline khác nhau là **hợp lệ** (khác namespace pipeline). Image trỏ tag `:latest`; Cloud Deploy resolve digest lúc render và ghim → rollback đúng digest dù `:latest` đổi sau.

## 3. Được submit bởi `deploy.yml`

Source: [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)

```bash
TAG="${{ github.event.inputs.tag || 'latest' }}"
SHA="${{ github.event.workflow_run.head_sha || github.sha }}"
REL="rel-${SHA:0:12}-$(date +%s)"          # tên release duy nhất, hợp lệ
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_TAG=${TAG},_RELEASE=${REL} \
  --service-account=projects/${PROJECT}/serviceAccounts/${DEPLOYER_SA} \
  --project=${PROJECT} .
```

| Điểm | Ghi chú |
|---|---|
| Trigger | `workflow_run` sau khi CI Backend/Frontend xong (main), hoặc `workflow_dispatch` tay |
| Auth | WIF → impersonate deployer SA ([WIF](../workload-identity-federation/in-this-project.md)) |
| **`--service-account=deployer SA`** | Build chạy dưới deployer (có `clouddeploy.releaser` + `actAs`), không phải Cloud Build SA mặc định |
| `concurrency: deploy-dev` | Không cho 2 release chồng nhau vào target dev |

> [!IMPORTANT]
> Chạy build dưới **deployer SA** là mấu chốt: bước `releases create` mới có `clouddeploy.releaser` + `actAs` execution SA. Đó cũng là lý do **bắt buộc** `logging: CLOUD_LOGGING_ONLY` (ràng buộc của custom build SA). Xem [on-gcp §2-3](./on-gcp.md).

## 4. Rollback — KHÔNG qua đây

Rollback không submit build mới; dùng **thẳng Cloud Deploy** (rollout/release trước). Xem [Cloud Deploy in This Project §5](../cloud-deploy/in-this-project.md) + `deploy/MIGRATION.md`.

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Cloud Deploy](../cloud-deploy/index.md) · [IAM](../iam/index.md) · [Workload Identity Federation](../workload-identity-federation/index.md)
