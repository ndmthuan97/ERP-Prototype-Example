---
type: Concept Explanation
title: "Redis Core Concepts"
description: "Building blocks: Key-value, TTL/expiry, data types, eviction policy, atomic operations, cache patterns (cache-aside, write-through), idempotency key"
tags: [redis, ttl, eviction, cache-aside, atomic, idempotency]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Redis Core Concepts

## Định nghĩa

Redis xây trên vài khái niệm cốt lõi. Nắm chúng = cache đúng, không stale, không mất tiền RAM.

## Tại sao quan trọng

Quên TTL → cache phình vô hạn / stale mãi. Không hiểu eviction → key biến mất bất ngờ. Không hiểu atomic → idempotency sai (dedupe hụt).

## Cách hoạt động

### 1. Key-Value — mô hình cơ bản

Redis lưu theo **key → value**. Key là string; value là một trong nhiều kiểu dữ liệu.

```
SET user:42:profile  "{...json...}"
GET user:42:profile  → "{...}"
DEL user:42:profile
```

> [!TIP]
> Đặt key có **namespace** rõ ràng (`entity:id:field`) để dễ quản, tránh đụng. Key sprawl (đặt lung tung) là nguồn bug khó lần.

### 2. TTL / Expiry — sống bao lâu

Mỗi key có thể đặt **thời gian sống** (TTL); hết hạn → tự xoá. Đây là cơ chế **quan trọng nhất** của cache.

```
SET catalog:list "..." EX 300     # sống 300s rồi tự biến mất
```

> [!IMPORTANT]
> **Cache phải có TTL.** Không TTL → dữ liệu stale ở lại mãi + RAM phình. Chọn TTL theo mức độ "chịu được cũ": data ít đổi → TTL dài; đổi thường → TTL ngắn.

### 3. Data types

| Type | Dùng cho |
|---|---|
| String | Cache JSON, đếm (INCR) |
| Hash | Object nhiều field |
| List | Queue, log gần đây |
| Set / Sorted Set | Tập không trùng, leaderboard, rate-limit theo thời gian |
| Stream | Event log (ít dùng khi đã có Pub/Sub) |

### 4. Eviction policy — khi RAM đầy

RAM có hạn; đầy thì Redis **evict** (đuổi) key theo chính sách (vd `allkeys-lru` — bỏ key ít dùng nhất). Hệ quả: **key có thể biến mất trước TTL**.

> [!WARNING]
> Vì eviction + restart, **không bao giờ** coi Redis là nơi lưu duy nhất dữ liệu quan trọng. Luôn có thể tái tạo từ nguồn (DB). Cache trống = chạy chậm, không phải chạy sai.

### 5. Atomic operations — nền của idempotency & lock

Nhiều lệnh Redis **atomic** (không bị chen giữa chừng) → dùng làm khoá / dedupe an toàn kể cả nhiều instance:

```
SET dedupe:msg-123 "1" NX EX 86400
  # NX = chỉ set nếu CHƯA tồn tại → trả OK lần đầu, nil lần sau
  # → biết message đã xử lý chưa (idempotency), atomic giữa nhiều instance
```

### 6. Cache patterns

| Pattern | Cách làm | Đánh đổi |
|---|---|---|
| **Cache-aside** (phổ biến nhất) | App đọc cache; miss → đọc DB, ghi cache | Đơn giản; lần đầu miss chậm |
| Write-through | Ghi DB + ghi cache cùng lúc | Cache luôn mới; ghi chậm hơn |
| Write-behind | Ghi cache trước, DB sau (async) | Nhanh; rủi ro mất nếu cache chết |

```
Cache-aside read:
  value = redis.get(key)
  if value == null:            # miss
      value = db.query(...)
      redis.set(key, value, ex=TTL)
  return value
```

### 7. Idempotency key — chống xử lý trùng

Message Pub/Sub giao at-least-once → có thể trùng. Dùng Redis lưu "đã xử lý" theo id, atomic `SET NX`:

```
if redis.set("processed:" + msgId, "1", nx=True, ex=TTL):
    handle(message)     # lần đầu → xử lý
else:
    skip()              # đã xử lý → bỏ qua (idempotent)
```

Xem cách ERP dùng ở [in-this-project](./in-this-project.md) và liên hệ [Pub/Sub Core Concepts §5](../pubsub/core-concepts.md).

## Ví dụ thực tế

```
Cache-aside cho catalog:
  GET catalog:products  → miss → SELECT từ Cloud SQL → SET catalog:products EX 300
  request sau trong 300s → cache hit (~1ms), không đập DB

Idempotency cho goods.received:
  SET processed:goods.received:<eventId> "1" NX EX 1d → OK lần đầu → trừ/cộng kho 1 lần
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Cache stale mãi | Quên TTL / không invalidate khi ghi | Đặt TTL; xoá key khi data đổi |
| Key biến mất bất ngờ | Eviction khi RAM đầy | Chấp nhận (cache-aside tự phục hồi); tăng RAM |
| Xử lý trùng dù có Redis | Dedupe không atomic | Dùng `SET NX` (atomic) |
| RAM phình | Key không TTL / key sprawl | TTL bắt buộc; namespace key |

## Related Concepts

- [Overview](./overview.md) — vì sao cache
- [Redis on GCP](./on-gcp.md) — Upstash REST vs Memorystore
- [Redis in This Project](./in-this-project.md) — RedisCacheService + idempotency
