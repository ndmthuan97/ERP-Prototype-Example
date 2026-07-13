# IAM & Service Accounts — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **IAM** (Identity & Access Management) và **Service Account** trên Google Cloud — nền tảng phân quyền mà mọi service khác đều dựa vào. Theo Pareto: 20% quan trọng nhất để nắm 80% năng lực bảo mật hệ thống.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | IAM là gì, mô hình Who-What-Which, danh tính người vs máy, least privilege |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Member, Role (primitive/predefined/custom), Binding, Policy, Service Account, actAs |
| [IAM on GCP](./on-gcp.md) | Concept Explanation | Resource hierarchy, service agents, IAM Conditions, scope binding, best practices |
| [IAM in This Project](./in-this-project.md) | Reference | Mapping → module `iam`: 3 SA (backend/frontend/deployer) + role bindings |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | 403, thiếu actAs, over-privilege, service agent, key JSON |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → mô hình Who-What-Which
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → member/role/binding/SA
3. **GCP cụ thể**: [IAM on GCP](./on-gcp.md) → hierarchy, service agents, conditions
4. **Áp dụng**: [IAM in This Project](./in-this-project.md) → 3 service account
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Workload Identity Federation](../workload-identity-federation/index.md) — GitHub impersonate deployer SA (keyless)
- [Secret Manager](../secret-manager/index.md) — nơi `secretAccessor` bind per-secret
- [Cloud Run](../cloud-run/index.md) — service chạy dưới runtime SA
