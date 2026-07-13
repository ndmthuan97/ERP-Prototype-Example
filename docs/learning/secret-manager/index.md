# Secret Manager — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Secret Manager** — "két sắt" managed cho bí mật (DB URL, JWT key, token) trên Google Cloud. Theo Pareto: 20% quan trọng nhất để lưu & phân phối bí mật an toàn.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Secret management là gì, tại sao không nhét env/config, secret sprawl, alternatives |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Secret vs Version, Replication, Accessor, Rotation, disable/destroy version |
| [Secret Manager on GCP](./on-gcp.md) | Concept Explanation | Auto vs user-managed replication, version aliases, tích hợp Cloud Run, CMEK, giá |
| [Secret Manager in This Project](./in-this-project.md) | Reference | Mapping → module `secrets`: 5 secret + pattern per-secret accessor |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Rotate không redeploy, project-wide access, hộp rỗng, secret trong git |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao không để bí mật trong env/config
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → secret/version/replication/rotation
3. **GCP cụ thể**: [Secret Manager on GCP](./on-gcp.md) → tích hợp Cloud Run, replication
4. **Áp dụng**: [Secret Manager in This Project](./in-this-project.md) → 5 secret + per-secret accessor
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [IAM & Service Accounts](../iam/index.md) — nơi `secretAccessor` bind per-secret
- [Cloud SQL](../cloud-sql/index.md) — nguồn `connection_url`/`direct_url`
- [Cloud Run](../cloud-run/index.md) — tiêu thụ secret qua `secret_key_ref`
