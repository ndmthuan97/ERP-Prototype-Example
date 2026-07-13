# Workload Identity Federation — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Workload Identity Federation (WIF)** — cho phép workload **ngoài GCP** (GitHub Actions) truy cập GCP **không cần key JSON**. Theo Pareto: 20% quan trọng nhất để dựng CI/CD keyless an toàn.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Vấn đề SA key tĩnh, keyless auth là gì, OIDC federation, vì sao WIF |
| [Core Concepts](./core-concepts.md) | Concept Explanation | OIDC token, Pool, Provider, Attribute mapping/condition, principalSet, Impersonation |
| [WIF on GCP](./on-gcp.md) | Concept Explanation | GitHub OIDC issuer, attribute condition security, direct WIF vs impersonation, siết branch |
| [WIF in This Project](./in-this-project.md) | Reference | Mapping → module `workload-identity`: pool + provider + binding |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Condition lỏng, sai github_repo, vẫn tạo key, auth fail |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vấn đề key tĩnh & keyless
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → pool/provider/condition/impersonation
3. **GCP cụ thể**: [WIF on GCP](./on-gcp.md) → GitHub OIDC, siết bảo mật
4. **Áp dụng**: [WIF in This Project](./in-this-project.md) → module workload-identity
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [IAM & Service Accounts](../iam/index.md) — deployer SA & `deployer_sa_id` được impersonate
- [Artifact Registry](../artifact-registry/index.md) — nơi CI push sau khi auth qua WIF
- [Cloud Run](../cloud-run/index.md) — đích cuối của pipeline deploy
