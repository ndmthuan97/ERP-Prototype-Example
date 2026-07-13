# Google Cloud Build — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Google Cloud Build** — dịch vụ chạy pipeline (build/test/deploy step) managed. Trong ERP, Cloud Build đóng vai **điều phối CD**: tạo 8 Cloud Deploy release song song. Theo Pareto: 20% quan trọng nhất.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Cloud Build là gì, vai trò build vs orchestrate, vs GitHub Actions, phân công CI/CD trong ERP |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Build config, Steps, Builder image, Substitutions, waitFor (parallel), Timeout, Logging, Artifacts |
| [Cloud Build on GCP](./on-gcp.md) | Concept Explanation | Builder images, service account (default vs custom), logging bắt buộc, triggers vs submit, giá |
| [Cloud Build in This Project](./in-this-project.md) | Reference | Mapping → `cloudbuild.yaml`: 8 bước tạo release song song, submit bởi deploy.yml dưới deployer SA |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Custom SA + logging, quyền releaser/actAs, substitutions, timeout |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → Cloud Build làm gì ở đây (không phải build image)
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → steps, substitutions, parallel
3. **GCP cụ thể**: [Cloud Build on GCP](./on-gcp.md) → SA, logging, triggers
4. **Áp dụng**: [Cloud Build in This Project](./in-this-project.md) → cloudbuild.yaml
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Cloud Deploy](../cloud-deploy/index.md) — bước sau: Cloud Build tạo release cho Cloud Deploy
- [Docker](../docker/index.md) & [Artifact Registry](../artifact-registry/index.md) — image (build ở GitHub Actions, không phải Cloud Build)
- [IAM](../iam/index.md) — deployer SA làm build SA + có clouddeploy.releaser
- [Workload Identity Federation](../workload-identity-federation/index.md) — GitHub auth để submit build
