# Cloud SQL (PostgreSQL) — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Cloud SQL** — PostgreSQL managed trên Google Cloud, DB chính của ERP Prototype. Theo Pareto: 20% quan trọng nhất để nắm 80% năng lực vận hành DB managed.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Managed database là gì, tại sao Cloud SQL, self-managed vs managed, so alternatives |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Instance, Tier, Edition, HA/availability, Storage, Backup/PITR, Read replica, Connection |
| [Cloud SQL on GCP](./on-gcp.md) | Concept Explanation | Private IP vs Public IP, Auth Proxy, IAM auth, ssl_mode, maintenance, giá |
| [Cloud SQL in This Project](./in-this-project.md) | Reference | Mapping → module `database`: instance, IP config, backup, max_connections, connection URL |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | too many connections, TLS/ssl_mode, disk full, deletion protection |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao dùng DB managed
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → instance/tier/backup/replica
3. **GCP cụ thể**: [Cloud SQL on GCP](./on-gcp.md) → private IP, Auth Proxy, ssl_mode
4. **Áp dụng**: [Cloud SQL in This Project](./in-this-project.md) → module database
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [VPC & Networking](../vpc/index.md) — Private Service Access cấp private IP cho Cloud SQL
- [Secret Manager](../secret-manager/index.md) — nơi cất connection string
- [Cloud Run](../cloud-run/index.md) — service tiêu thụ DB
- [data-model.md](../../architecture/data-model.md) — schema 13 bảng
