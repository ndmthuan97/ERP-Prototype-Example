# Google Cloud Deploy — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Google Cloud Deploy** — dịch vụ CD (continuous delivery) managed, sở hữu spec + rollout của các Cloud Run service trong ERP. Theo Pareto: 20% quan trọng nhất để hiểu release/rollout/rollback.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | CD là gì, CI vs CD, tại sao Cloud Deploy, vs gcloud tay / ArgoCD / Spinnaker |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Delivery Pipeline, Target, Release, Rollout, Render (Skaffold), Promotion, Rollback |
| [Cloud Deploy on GCP](./on-gcp.md) | Concept Explanation | Skaffold render, cloudrun deployer, execution config/SA, ghim digest, verify/approval |
| [Cloud Deploy in This Project](./in-this-project.md) | Reference | Mapping → `deploy/clouddeploy.yaml`: 8 pipeline + target dev, skaffold + service.yaml |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Singular node, thiếu quyền execution SA, rollback đúng cách, spec drift |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → CI vs CD, vì sao Cloud Deploy
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → pipeline/target/release/rollout
3. **GCP cụ thể**: [Cloud Deploy on GCP](./on-gcp.md) → skaffold, execution SA, digest
4. **Áp dụng**: [Cloud Deploy in This Project](./in-this-project.md) → 8 pipeline + target dev
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Cloud Build](../cloud-build/index.md) — tạo Cloud Deploy release (bước trước)
- [Cloud Run](../cloud-run/index.md) — đích rollout; Cloud Deploy sở hữu spec service
- [Artifact Registry](../artifact-registry/index.md) — nguồn image được ghim digest
- [IAM](../iam/index.md) — deployer SA làm execution SA (RENDER+DEPLOY)
