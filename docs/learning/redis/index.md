# Redis — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Redis** — in-memory data store, dùng làm cache + idempotency trong ERP (qua **Upstash Redis** REST API). Theo Pareto: 20% quan trọng nhất để cache đúng, không mất tiền, không sai dữ liệu.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Redis là gì, tại sao cache, in-memory vs DB, khi nào dùng |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Key-value, TTL/expiry, data types, eviction, atomic ops, cache patterns |
| [Redis on GCP](./on-gcp.md) | Concept Explanation | Upstash (REST, serverless) vs Memorystore (TCP, VPC) — chọn cái nào |
| [Redis in This Project](./in-this-project.md) | Reference | Mapping → `shared/cache/RedisCacheService`: Upstash REST, cache + idempotency |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Cache stampede, stale data, quên TTL, key sprawl, dùng cache như source of truth |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao cần cache in-memory
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → TTL, data types, patterns
3. **GCP cụ thể**: [Redis on GCP](./on-gcp.md) → Upstash vs Memorystore
4. **Áp dụng**: [Redis in This Project](./in-this-project.md) → RedisCacheService
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Secret Manager](../secret-manager/index.md) — `upstash-redis-url/token` được cất ở đây
- [Pub/Sub](../pubsub/index.md) — idempotency dùng Redis để dedupe (at-least-once)
- [Cloud SQL](../cloud-sql/index.md) — source of truth; Redis chỉ là cache
- [Cloud Run](../cloud-run/index.md) — service inject env Upstash qua secret_key_ref
