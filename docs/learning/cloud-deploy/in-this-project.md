---
type: Reference
title: "Cloud Deploy in This Project"
description: "Mapping Cloud Deploy → deploy/clouddeploy.yaml trong ERP Prototype: 8 Delivery Pipeline + 1 Target dev, skaffold + service.yaml mỗi service, sở hữu spec Cloud Run"
tags: [cloud-deploy, terraform, erp, gcp, skaffold, cloud-run]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://deploy/clouddeploy.yaml"
---

# Cloud Deploy in This Project

> Cloud Deploy sở hữu **spec + rollout** của 8 Cloud Run service. Mọi thứ nằm trong thư mục `deploy/`.

> Liên quan: [Cloud Build](../cloud-build/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md) · [IAM](../iam/in-this-project.md)

---

## 1. Cấu trúc `deploy/`

```
deploy/
├── clouddeploy.yaml            # 8 DeliveryPipeline + 1 Target dev
├── MIGRATION.md                # hướng dẫn bàn giao từ Terraform → Cloud Deploy
├── <service>/skaffold.yaml     # render config (cloudrun deployer)
└── <service>/service.yaml      # Knative Service manifest — SPEC SOURCE OF TRUTH
```

## 2. `clouddeploy.yaml` — 8 pipeline + 1 target

Source: [`deploy/clouddeploy.yaml`](../../deploy/clouddeploy.yaml)

```yaml
kind: Target
metadata: { name: dev }
executionConfigs:
  - usages: [RENDER, DEPLOY]
    serviceAccount: erp-deployer-dev@portfolio-497506.iam.gserviceaccount.com
run:
  location: projects/portfolio-497506/locations/us-central1
---
kind: DeliveryPipeline
metadata: { name: erp-api-gateway }
serialPipeline: { stages: [ { targetId: dev } ] }
# ... 7 pipeline nữa: erp-auth-service, erp-customer-service, erp-sales-service,
#     erp-inventory-service, erp-catalog-service, erp-purchasing-service, erp-frontend
```

| Thành phần | Giá trị | Ghi chú |
|---|---|---|
| **8 DeliveryPipeline** | `erp-<service>` | 1 pipeline / service |
| **1 Target** | `dev` | Mọi pipeline trỏ chung target này |
| **Execution SA** | `erp-deployer-dev` | RENDER+DEPLOY dùng deployer SA ([IAM](../iam/in-this-project.md)) |
| **Location** | `us-central1` | Cùng region Cloud Run/Registry |

> [!WARNING]
> **Vì sao 8 pipeline chứ không 1?** Deployer `cloudrun` của Skaffold chỉ nhận **1 service/pipeline** (*"expected singular node ... but was 8"*). Microservices → mỗi service 1 pipeline. Xem [on-gcp §2](./on-gcp.md).

## 3. `skaffold.yaml` + `service.yaml` mỗi service

Source: [`deploy/auth-service/skaffold.yaml`](../../deploy/auth-service/skaffold.yaml) · [`deploy/auth-service/service.yaml`](../../deploy/auth-service/service.yaml)

```yaml
# skaffold.yaml — render dùng cloudrun deployer
kind: Config
manifests: { rawYaml: [service.yaml] }
deploy: { cloudrun: {} }
```

```yaml
# service.yaml — SPEC SOURCE OF TRUTH (thay cho module cloud-run của Terraform)
kind: Service
metadata:
  name: auth-service-dev
  annotations: { run.googleapis.com/ingress: all }
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: '0'
        autoscaling.knative.dev/maxScale: '3'
        run.googleapis.com/vpc-access-connector: erp-vpc-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      serviceAccountName: erp-backend-dev@portfolio-497506.iam.gserviceaccount.com
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: auth-service        # placeholder → thay bằng --images lúc release
          ports: [ { containerPort: 3004 } ]
          resources: { limits: { cpu: '1', memory: 512Mi } }
          env:
            - { name: DATABASE_URL, valueFrom: { secretKeyRef: { name: database-url-dev, key: latest } } }
            - { name: UPSTASH_REDIS_REST_URL, valueFrom: { secretKeyRef: { name: upstash-redis-url-dev, key: latest } } }
            # ... DIRECT_URL, JWT_SECRET, UPSTASH_REDIS_REST_TOKEN, NODE_ENV, PUBSUB_PROJECT_ID
          startupProbe: { httpGet: { path: /health/live }, ... }
```

> [!IMPORTANT]
> `service.yaml` chính là **spec service Cloud Run** — nơi khai port/scale/VPC/SA/secret/probe. Trước đây do module `cloud-run` (Terraform) khai; nay Cloud Deploy sở hữu. Đây là **điểm drift** với Terraform — xem [Cloud Run in This Project §0](../cloud-run/in-this-project.md). `image: auth-service` là placeholder, thay bằng `--images` lúc tạo release.

## 4. Luồng release (từ Cloud Build)

```
Cloud Build (8 bước song song): gcloud deploy releases create
  --delivery-pipeline=erp-<service> --source=deploy/<service> --images=<svc>=...:TAG
     ↓ Cloud Deploy render (skaffold) → ghim digest
     ↓ rollout vào Target dev
  Cloud Run <service>-dev cập nhật
```

Xem bước trước: [Cloud Build in This Project](../cloud-build/in-this-project.md).

## 5. Bootstrap & Rollback

```bash
# Áp/cập nhật pipeline + target
gcloud deploy apply --file=deploy/clouddeploy.yaml --region=us-central1 --project=portfolio-497506

# Rollback: KHÔNG dùng deploy.yml — dùng thẳng Cloud Deploy (về rollout/release trước)
# Chi tiết: deploy/MIGRATION.md
```

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Cloud Build](../cloud-build/index.md) · [Cloud Run](../cloud-run/index.md) · [IAM](../iam/index.md)
