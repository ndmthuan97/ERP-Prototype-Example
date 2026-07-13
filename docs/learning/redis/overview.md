---
type: Learning Note
title: "Redis Overview"
description: "Redis là gì, tại sao cache in-memory, cache vs database, khi nào nên/không nên dùng, so sánh Redis với Memcached"
tags: [learning, redis, cache, in-memory, upstash, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Redis Overview

## Summary

**Redis** = kho dữ liệu **in-memory** (nằm trong RAM) key-value, cực nhanh (sub-millisecond). Dùng làm **cache** (đệm trước DB), **session store**, **rate-limit**, **idempotency**, **lock**. Trong ERP: cache + idempotency, truy cập qua **Upstash Redis** (REST API).

```
   Không cache                          Có Redis cache
  ┌─────┐  mỗi request   ┌────┐        ┌─────┐  cache hit ┌───────┐
  │ App │───────────────▶│ DB │        │ App │──────┬────▶│ Redis │ (RAM, ~1ms)
  │     │◀─── chậm ───────│    │        │     │      │miss └───────┘
  └─────┘  (I/O đĩa)      └────┘        └─────┘      └────▶  DB (chỉ khi miss)
```

## Key Concepts

### Vì sao cần cache in-memory?

| Vấn đề | Không cache | Có Redis |
|---|---|---|
| Đọc lặp lại data ít đổi | Mỗi lần hỏi DB (chậm, tốn connection) | Đọc từ RAM (~1ms), giảm tải DB |
| DB là nút thắt | Mọi read đập vào DB | Cache chặn phần lớn read |
| Cần đếm/khoá nhanh | DB transaction nặng | Atomic op in-memory |

> [!IMPORTANT]
> Cache là **bản sao tạm** của dữ liệu, **không** phải nguồn sự thật. Nguồn sự thật vẫn là [Cloud SQL](../cloud-sql/index.md). Cache có thể mất bất kỳ lúc nào (evict/restart) → app phải chạy đúng khi cache trống (chỉ chậm hơn).

### In-memory vs Database

| | Redis (in-memory) | Postgres (on-disk) |
|---|---|---|
| Tốc độ | Sub-ms | ms (I/O đĩa) |
| Bền vững | Dễ mất (RAM) | Bền (đĩa + backup) |
| Query phức tạp | Hạn chế (key-value) | SQL đầy đủ |
| Vai trò | Cache/đệm | Source of truth |

### Khi nào dùng — khi nào không

**Nên** dùng Redis khi:
- Đọc lặp lại data ít thay đổi (catalog, config, lookup).
- Cần **idempotency** (dedupe message Pub/Sub at-least-once).
- Rate-limit, session, distributed lock, đếm nhanh.

**Không** nên khi:
- Dữ liệu cần bền tuyệt đối làm nguồn chính → dùng DB.
- Query quan hệ phức tạp → dùng DB.
- Data thay đổi liên tục + phải luôn mới nhất → cache dễ stale.

### Redis vs Memcached

| | **Redis** | Memcached |
|---|---|---|
| Data types | Nhiều (string, hash, list, set, sorted set, stream) | Chỉ string |
| Persistence | Có (tuỳ chọn) | Không |
| Atomic ops | Phong phú | Cơ bản |
| Dùng cho | Cache + nhiều hơn (lock, queue, idempotency) | Cache thuần |

Redis linh hoạt hơn → mặc định hợp lý cho hầu hết nhu cầu.

### Vị trí trong kiến trúc ERP

```
Cloud Run backend ──(HTTPS REST)──▶ Upstash Redis (cache + idempotency)
       │  cache miss / write                      ▲ credentials từ Secret Manager
       ▼
   Cloud SQL (source of truth)
```

## Practical Application

Trong ERP, Redis (Upstash) dùng để:
- **Cache** dữ liệu đọc nhiều (giảm tải Cloud SQL).
- **Idempotency**: dedupe khi consumer Pub/Sub nhận message trùng (at-least-once). Xem [Pub/Sub](../pubsub/index.md).

## References

- [Redis Docs](https://redis.io/docs/latest/) — tài liệu chính thức
- [Upstash Redis](https://upstash.com/docs/redis) — Redis REST serverless (dùng trong dự án)
- [Cache patterns](https://redis.io/docs/latest/develop/use/patterns/) — cache-aside, write-through...

## Related Concepts

- [Core Concepts](./core-concepts.md) — TTL, data types, cache patterns
- [Redis on GCP](./on-gcp.md) — Upstash vs Memorystore
- [Redis in This Project](./in-this-project.md) — RedisCacheService
