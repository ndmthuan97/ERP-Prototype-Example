# Learning

Tài liệu học tập và nghiên cứu — ghi chú kiến thức, so sánh công nghệ, cheat sheets.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Skill Assessment & Roadmap](./skill-assessment-roadmap.md) | Reference | Phân loại 30 skills theo 3 mức (MUST / TRACK / SKIP), chọn 1 trong 3 track chuyên môn |

## Subdirectories

Mỗi bundle = một công nghệ, theo Pareto 80/20: `overview` → `core-concepts` → `on-gcp`/`best-practices` → `in-this-project` → `troubleshooting`. Nhóm **GCP services** map 1-1 với module Terraform trong `infra/modules/` (trừ VPC đã có bundle riêng); các bundle khác map tới file/luồng thật trong repo.

### Nền tảng IaC

| Directory | Mô tả |
|-----------|-------|
| [terraform/](./terraform/index.md) | Terraform (IaC) — Pareto 80/20 knowledge bundle |

### GCP services (↔ Terraform module)

| Directory | Mô tả |
|-----------|-------|
| [vpc/](./vpc/index.md) | VPC & Cloud Networking — module `networking` |
| [cloud-run/](./cloud-run/index.md) | Cloud Run (serverless containers) — module `cloud-run` |
| [cloud-sql/](./cloud-sql/index.md) | Cloud SQL (PostgreSQL managed) — module `database` |
| [iam/](./iam/index.md) | IAM & Service Accounts — module `iam` |
| [secret-manager/](./secret-manager/index.md) | Secret Manager — module `secrets` |
| [pubsub/](./pubsub/index.md) | Pub/Sub (messaging bất đồng bộ) — module `pubsub` |
| [artifact-registry/](./artifact-registry/index.md) | Artifact Registry (Docker images) — module `registry` |
| [workload-identity-federation/](./workload-identity-federation/index.md) | Workload Identity Federation (CI/CD keyless) — module `workload-identity` |

### Build & Delivery (CI/CD)

| Directory | Mô tả |
|-----------|-------|
| [docker/](./docker/index.md) | Docker (container) — `backend/Dockerfile` + `frontend/Dockerfile` |
| [cloud-build/](./cloud-build/index.md) | Google Cloud Build — `cloudbuild.yaml` (điều phối 8 release) |
| [cloud-deploy/](./cloud-deploy/index.md) | Google Cloud Deploy — `deploy/clouddeploy.yaml` (8 pipeline + target dev) |

### App runtime & Testing

| Directory | Mô tả |
|-----------|-------|
| [redis/](./redis/index.md) | Redis (Upstash REST) — `shared/cache/RedisCacheService` (cache + idempotency) |
| [jest-testing/](./jest-testing/index.md) | Jest Testing — backend NestJS (ts-jest, e2e, CI quality gate) |

### Data & Analytics (roadmap)

| Directory | Mô tả |
|-----------|-------|
| [bigquery/](./bigquery/index.md) | BigQuery (OLAP warehouse) — **chưa triển khai**; roadmap CDC reporting |

