---
type: Learning Note
title: "Pub/Sub Overview"
description: "Messaging bất đồng bộ là gì, sync vs async, tại sao decouple service, so sánh Pub/Sub với Kafka / SQS / RabbitMQ"
tags: [learning, pubsub, messaging, event-driven, async, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Pub/Sub Overview

## Summary

**Pub/Sub** = "đường ống sự kiện" bất đồng bộ. Service A **publish** một event lên **topic** rồi quên nó đi; service B **nhận** qua **subscription** khi rảnh. A không cần biết ai đang nghe, cũng **không chờ** B xử lý xong.

```
   Đồng bộ (gọi trực tiếp)              Bất đồng bộ (Pub/Sub)
  ┌─────┐  request   ┌─────┐          ┌─────┐ publish ┌───────┐ ┌─────┐
  │  A  │───────────▶│  B  │          │  A  │────────▶│ Topic │─│ Sub │─▶ B
  │     │◀───────────│     │          └─────┘  xong   └───────┘ └─────┘
  └─────┘  chờ B     └─────┘            A đi tiếp ngay; B xử lý khi rảnh
   A chết nếu B chậm/lỗi                A không phụ thuộc B đang sống
```

## Key Concepts

### Sync vs Async — đánh đổi

| | Đồng bộ (HTTP call) | Bất đồng bộ (Pub/Sub) |
|---|---|---|
| A chờ B | Có — coupling thời gian | Không — fire-and-forget |
| B chết thì A? | A lỗi/timeout theo | A vẫn chạy; message chờ B sống lại |
| Phản hồi tức thì | Có | Không (eventual) |
| Hợp cho | Cần kết quả ngay (đọc dữ liệu) | Side-effect, thông báo, xử lý nền |

### Vì sao decouple?

```
Đơn hàng confirmed → cần: trừ kho, gửi email, ghi analytics, cập nhật CRM...
```

- **Đồng bộ**: sales-service phải gọi lần lượt 4 service; 1 cái chậm/chết → cả request chậm/hỏng. Thêm consumer mới = sửa sales-service.
- **Bất đồng bộ**: sales-service chỉ publish `sales-order.confirmed`. Ai quan tâm thì subscribe. Thêm consumer mới **không đụng** sales-service.

> [!IMPORTANT]
> Lợi ích lớn nhất của Pub/Sub là **decouple**: publisher không biết (và không cần biết) subscriber. Đây là nền của kiến trúc event-driven — thêm/bớt consumer không sửa producer.

### So sánh các hệ messaging

| | **Pub/Sub** | Kafka | SQS (AWS) | RabbitMQ |
|---|---|---|---|---|
| Managed | ✅ Google lo | Tự vận hành (hoặc Confluent) | ✅ AWS | Tự vận hành |
| Mô hình | Topic + Subscription | Topic + Partition + Log | Queue | Exchange + Queue |
| Replay lịch sử | Giới hạn (retention) | ✅ Mạnh (log lâu dài) | Không | Không |
| Ordering | Theo key (tuỳ chọn) | Theo partition | FIFO queue | Có |
| Hợp cho | Event async managed trên GCP | Stream lớn, replay, analytics | Queue đơn giản trên AWS | Routing phức tạp |

Dự án ở GCP, cần event async giữa microservice, **không** cần replay log kiểu Kafka → **Pub/Sub** đúng nấc.

### At-least-once — hệ quả phải nhớ

Pub/Sub đảm bảo giao **ít nhất một lần** → message **có thể trùng**. Consumer **phải idempotent** (xử lý trùng không sai). Đây là đánh đổi cơ bản của mọi hệ messaging phân tán.

### Cross-cloud

| GCP | AWS | Azure |
|---|---|---|
| **Pub/Sub** | SNS + SQS | Service Bus / Event Grid |

### Vị trí trong kiến trúc ERP

```
sales-service ─publish─▶ sales-order.fulfilled ─sub─▶ inventory-service (trừ kho)
                         sales-order.cancelled ─sub─▶ inventory-service (hoàn kho)
catalog       ─publish─▶ product.created       ─sub─▶ inventory-service (khởi tạo tồn)
```

## Practical Application

Dùng Pub/Sub khi:
- Side-effect không cần phản hồi ngay (trừ kho, gửi mail, analytics).
- Muốn thêm consumer mà không sửa producer.
- Chịu được **eventual consistency** (xử lý sau vài giây).

Dùng gọi đồng bộ (HTTP) khi:
- Cần **kết quả ngay** trong request (đọc dữ liệu để trả về user).

## References

- [Pub/Sub Docs](https://cloud.google.com/pubsub/docs) — tài liệu chính thức
- [Pub/Sub vs Kafka](https://cloud.google.com/pubsub/docs/migrating-from-kafka) — so sánh & migrate
- [Dead-letter topics](https://cloud.google.com/pubsub/docs/handling-failures) — xử lý message lỗi

## Related Concepts

- [Core Concepts](./core-concepts.md) — topic, subscription, ack, dead-letter
- [Pub/Sub on GCP](./on-gcp.md) — push vs pull, service agent
- [Pub/Sub in This Project](./in-this-project.md) — 9 topic sự kiện ERP
