---
type: Concept Explanation
title: "Pub/Sub Core Concepts"
description: "Building blocks: Topic, Subscription, Publisher/Subscriber, Ack/Nack, At-least-once, Dead-letter, Retry backoff, Message ordering"
tags: [pubsub, topic, subscription, ack, dead-letter, retry, ordering]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Pub/Sub Core Concepts

## Định nghĩa

Pub/Sub xây trên vài khái niệm cốt lõi. Nắm chúng = thiết kế luồng sự kiện không mất message, không kẹt vô hạn.

## Tại sao quan trọng

Không hiểu ack/at-least-once → xử lý trùng (trừ kho 2 lần). Không hiểu dead-letter → message lỗi retry vô hạn làm nghẽn. Không hiểu subscription → tưởng nhiều sub chia tải (thực ra mỗi sub nhận bản đầy đủ).

## Cách hoạt động

### 1. Topic — kênh sự kiện

Một **topic** = kênh có tên (`sales-order.confirmed`). Publisher bắn message vào đây. Topic **không lưu** message nếu không có subscription nào (hoặc theo retention cấu hình).

### 2. Subscription — "ống hút" gắn vào topic

Mỗi **subscription** nhận **bản sao riêng** của **mọi** message trên topic. Consumer đọc từ subscription, **không** đọc thẳng topic.

```
                    ┌── sub-A ──▶ consumer A (nhận TẤT CẢ message)
Topic  ────────────┤
(1 message)         └── sub-B ──▶ consumer B (cũng nhận TẤT CẢ message)
```

> [!IMPORTANT]
> **Nhiều subscription ≠ chia tải.** Mỗi sub nhận **bản đầy đủ**. Muốn **chia tải**, dùng nhiều consumer trên **cùng một** subscription (Pub/Sub tự phân phối message giữa chúng).

### 3. Publisher / Subscriber

- **Publisher**: service bắn message (cần `roles/pubsub.publisher`).
- **Subscriber**: service nhận message (cần `roles/pubsub.subscriber`).

### 4. Ack / Nack — xác nhận xử lý

```
Pub/Sub gửi message ──▶ consumer xử lý
   ├── xử lý xong  → ACK  → Pub/Sub xoá message (không gửi lại)
   └── lỗi/không ack trong ack_deadline → gửi LẠI (redelivery)
```

**Ack deadline**: thời gian consumer có để ack (dự án: 60s). Quá hạn → coi như fail → gửi lại.

### 5. At-least-once & Idempotency

Message giao **ít nhất một lần** → **có thể trùng** (do redelivery, hoặc consumer ack trễ). Consumer phải **idempotent**:

```
❌ Không idempotent: mỗi lần nhận goods.received → tồn += qty   (nhận 2 lần → +2 lần)
✅ Idempotent:       dedupe theo message-id / order-id; xử lý rồi thì bỏ qua
```

### 6. Dead-letter — chỗ cho message "chết"

Message fail quá `max_delivery_attempts` (dự án: 5) → đẩy sang **dead-letter topic** thay vì retry vô hạn. Đem điều tra sau, không làm nghẽn subscription chính.

```
sub chính: thử 1,2,3,4,5 → vẫn fail → chuyển sang dead-letter topic
                                        (dead-letter-sub giữ để soi)
```

> [!WARNING]
> Dead-lettering cần **IAM cho service agent của Pub/Sub** (Google agent, không phải SA app). Thiếu → dead-lettering **fail âm thầm**, message retry mãi. Xem [in-this-project](./in-this-project.md) + [on-gcp §4](./on-gcp.md).

### 7. Retry policy — backoff giữa các lần gửi lại

Chờ **tăng dần** (exponential backoff) giữa các lần retry để tránh dồn dập:

```
retry: min_backoff 10s → ... → max_backoff 600s   (dự án)
```

### 8. Message ordering

Mặc định **không đảm bảo thứ tự**. Bật ordering (theo `ordering_key`) nếu cần xử lý đúng trình tự — đánh đổi throughput. Dự án hiện **không** bật ordering (các event độc lập nhau).

## Ví dụ thực tế

```
sales-service publish sales-order.fulfilled
  → subscription "inventory-service.sales-order.fulfilled"
  → inventory consume, trừ kho, ACK
  → nếu inventory lỗi 5 lần: message → dead-letter topic → dead-letter-sub (điều tra)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Xử lý trùng (trừ kho 2 lần) | Consumer không idempotent (at-least-once) | Dedupe theo message-id / khoá nghiệp vụ |
| Message gửi lại giữa chừng | Xử lý lâu hơn `ack_deadline` | Tăng deadline hoặc extend deadline khi xử lý |
| Message lỗi retry vô hạn | Không cấu hình dead-letter, hoặc thiếu IAM agent | Cấu hình dead-letter + cấp quyền service agent |
| Tưởng nhiều sub chia tải | Mỗi sub nhận bản đầy đủ | Chia tải = nhiều consumer trên **1** sub |
| Publish nhưng "mất" message | Không có subscription lúc publish | Tạo sub trước; hoặc chấp nhận có chủ đích |

## Related Concepts

- [Overview](./overview.md) — sync vs async, decouple
- [Pub/Sub on GCP](./on-gcp.md) — push vs pull, service agent
- [Pub/Sub in This Project](./in-this-project.md) — 9 topic + dead-letter
