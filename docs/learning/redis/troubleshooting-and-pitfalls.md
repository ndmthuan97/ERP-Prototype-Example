---
type: Reference
title: "Redis — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: cache stampede, stale data, quên invalidate, coi cache là source of truth, dedupe không atomic, token lộ"
tags: [redis, upstash, troubleshooting, pitfalls, cache, idempotency, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://backend/shared/src/cache/redis-cache.service.ts"
---

# Redis — Troubleshooting & Pitfalls

> Tra cứu nhanh khi cache sai, stale, hoặc idempotency hụt.

## 1. Tính đúng đắn của cache

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Data cũ trả về sau khi đã sửa | Không invalidate cache khi ghi DB | Xoá (`del`) key liên quan khi update; hoặc TTL ngắn |
| Cache stale mãi | Quên đặt TTL | Luôn `set` kèm `ex` (TTL) |
| App trả sai khi Redis trống | Coi cache là source of truth | Cache-aside: miss → đọc DB → ghi lại cache |

## 2. Hiệu năng / chi phí

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| **Cache stampede** (nhiều request cùng miss 1 key hết hạn → đập DB cùng lúc) | Key nóng hết hạn đồng loạt | Jitter TTL; lock tái tạo; stale-while-revalidate |
| Latency cao mỗi thao tác | REST HTTP round-trip/lệnh (Upstash) | Gộp thao tác; cân nhắc Memorystore nếu thật nóng |
| RAM/chi phí phình | Key không TTL / key sprawl | TTL bắt buộc; namespace key `entity:id:field` |

## 3. Idempotency

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Xử lý trùng dù có dedupe | Dedupe không atomic (GET rồi SET tách rời) | Dùng `SET NX` (atomic) qua `getClient()` |
| Dedupe hết hạn quá sớm → xử lý lại | TTL idempotency key ngắn hơn cửa sổ redelivery | Đặt TTL đủ dài (vd 1 ngày) |

## 4. Kết nối / cấu hình (Upstash)

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Client không kết nối | `UPSTASH_REDIS_REST_URL/TOKEN` rỗng/sai | Kiểm secret inject đúng env; xem [in-this-project §4](./in-this-project.md) |
| Cố dùng client TCP | Upstash là REST | Dùng `@upstash/redis` (REST) |
| Token lộ | Hardcode / commit | Chỉ để trong Secret Manager |

## 5. Nguyên tắc vàng

- **Cache luôn có TTL.** Không TTL = bug chờ nổ.
- **Cache là bản sao, không phải nguồn.** App phải đúng khi cache trống.
- **Invalidate khi ghi.** Sửa DB → xoá/ghi lại cache key liên quan.
- **Dedupe phải atomic** (`SET NX`).

## Related Concepts

- [Redis in This Project](./in-this-project.md) — RedisCacheService
- [Core Concepts](./core-concepts.md) — TTL, eviction, atomic, patterns
- [Pub/Sub Troubleshooting](../pubsub/troubleshooting-and-pitfalls.md) — idempotency & at-least-once
