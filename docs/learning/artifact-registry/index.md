# Artifact Registry — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Artifact Registry** — kho chứa Docker image managed trên Google Cloud, trung tâm supply chain của ERP. Theo Pareto: 20% quan trọng nhất để build/push/pull image và quản vòng đời an toàn.

## Concepts

| Concept                                                         | Type                | Mô tả                                                                                  |
| --------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| [Overview](./overview.md)                                       | Learning Note       | Container registry là gì, tại sao registry riêng tư, supply chain, vs Docker Hub / GCR |
| [Core Concepts](./core-concepts.md)                             | Concept Explanation | Repository, Format, Image/Tag/Digest, Layers, Cleanup policy, Immutability             |
| [Artifact Registry on GCP](./on-gcp.md)                         | Concept Explanation | AR vs Container Registry (GCR) deprecated, location, IAM, vulnerability scanning, giá  |
| [Artifact Registry in This Project](./in-this-project.md)       | Reference           | Mapping → module `registry`: repo `erp-services` + cleanup keep 20 cho rollback        |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference           | Cleanup quá gắt, khác region, tag latest, thiếu quyền push/pull                        |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao registry riêng
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → repo/tag/digest/cleanup
3. **GCP cụ thể**: [Artifact Registry on GCP](./on-gcp.md) → GCR deprecated, IAM, scanning
4. **Áp dụng**: [Artifact Registry in This Project](./in-this-project.md) → repo erp-services
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Cloud Run](../cloud-run/index.md) — tiêu thụ image khi deploy
- [IAM & Service Accounts](../iam/index.md) — deployer `artifactregistry.writer`
- [Workload Identity Federation](../workload-identity-federation/index.md) — CI auth để push (keyless)
