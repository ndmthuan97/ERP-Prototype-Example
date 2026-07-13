---
type: Concept Explanation
title: "Pub/Sub on GCP"
description: "Đặc thù GCP: Push vs Pull subscription, message retention, exactly-once delivery, Pub/Sub service agent cho dead-letter, mô hình giá"
tags: [pubsub, gcp, push, pull, service-agent, retention, pricing]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Pub/Sub on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách message **được giao** cho consumer và ai là SA "vô hình" lo dead-letter.

## Cách hoạt động

### 1. Push vs Pull subscription

| | **Pull** | **Push** |
|---|---|---|
| Cơ chế | Consumer chủ động kéo message về | Pub/Sub POST message tới 1 HTTP endpoint |
| Hợp cho | Worker chạy nền, kiểm soát tốc độ | Cloud Run/Functions nhận qua HTTP |
| Kiểm soát backpressure | Tốt (consumer tự điều tiết) | Pub/Sub điều tiết theo phản hồi |
| Xác thực | SA của consumer | OIDC token gắn vào request |

```
Pull:  worker ──"cho tôi message"──▶ Pub/Sub ──message──▶ worker
Push:  Pub/Sub ──HTTP POST message──▶ https://svc/handler (Cloud Run)
```

> Với Cloud Run, **push** rất tự nhiên (service là HTTP endpoint sẵn); **pull** hợp worker chủ động. Chọn theo mô hình consumer.

### 2. Message retention

- **Subscription retention**: giữ message **chưa ack** bao lâu (dự án: `604800s` = **7 ngày**). Quá hạn → message bị bỏ.
- **Topic retention**: (tuỳ chọn) giữ cả message **đã ack** để tạo subscription mới replay — dự án đặt retention ở cả topic (7 ngày).

### 3. Exactly-once delivery (tuỳ chọn)

GCP có thể bật **exactly-once** trên subscription (trong 1 vùng) → giảm trùng lặp. Đánh đổi: throughput/độ trễ. Mặc định là **at-least-once** (dự án dùng mặc định → consumer vẫn cần idempotent).

### 4. Pub/Sub Service Agent — SA "vô hình" cho dead-letter

Việc **chuyển message chết** sang dead-letter do **service agent của Google** làm, không phải SA app:

```
service-<PROJECT_NUMBER>@gcp-sa-pubsub.iam.gserviceaccount.com
```

Agent này cần:
- `roles/pubsub.publisher` trên **dead-letter topic** (để bỏ message chết vào).
- `roles/pubsub.subscriber` trên **mỗi source subscription** (để lấy message ra).

> [!WARNING]
> **Thiếu 2 grant này → dead-lettering fail âm thầm.** Message fail sẽ retry vô hạn thay vì rơi vào dead-letter. Đây là bẫy IAM đặc thù GCP — xem [in-this-project](./in-this-project.md). Liên hệ khái niệm service agent tổng quát: [IAM on GCP §2](../iam/on-gcp.md).

### 5. Ordering & regions

- **Ordering** theo `ordering_key` chỉ đảm bảo trong cùng region.
- Pub/Sub là **global** nhưng có thể ghim message storage theo region (data residency).

### 6. Mô hình giá

```
Chi phí ≈ (throughput: GB message publish + deliver) [+ retention lưu trữ] [+ egress liên vùng]
```

| Yếu tố | Ghi chú |
|---|---|
| Throughput | Tính theo dung lượng message publish + phân phối |
| Retention | Giữ message lâu → tốn lưu trữ |
| Egress | Message qua region khác tính egress |

> Free tier hàng tháng đủ cho dev nhỏ. Chi phí thật đến từ **throughput** khi tải lớn.

## Ví dụ thực tế

```
9 topic + dead-letter, retention 7 ngày, ack 60s, at-least-once (mặc định)
Consumer inventory-service: chọn pull hoặc push tuỳ triển khai
Dead-letter: Pub/Sub service agent có publisher (dead-letter topic) + subscriber (mỗi source sub)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Dead-letter không hoạt động | Service agent thiếu publisher/subscriber | Cấp 2 role cho `service-<num>@gcp-sa-pubsub` |
| Push endpoint bị 401/403 | Thiếu cấu hình OIDC / invoker cho push | Cấp `run.invoker` cho push SA; cấu hình OIDC |
| Message biến mất sau 7 ngày | Chưa ack trong retention | Xử lý kịp; tăng retention nếu cần |
| Trùng lặp dù nghĩ "exactly-once" | Chưa bật exactly-once (mặc định at-least-once) | Bật exactly-once hoặc làm consumer idempotent |

## Related Concepts

- [Core Concepts](./core-concepts.md) — ack, dead-letter, at-least-once
- [Pub/Sub in This Project](./in-this-project.md) — topology + IAM service agent
- [IAM on GCP](../iam/on-gcp.md) — service agents
