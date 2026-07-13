---
type: Reference
title: "Pub/Sub in This Project"
description: "Mapping Pub/Sub → module pubsub trong ERP Prototype: 9 topic sự kiện + dead-letter pattern + IAM cho Pub/Sub service agent"
tags: [pubsub, terraform, erp, gcp, event-driven, dead-letter]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/pubsub/main.tf"
---

# Pub/Sub in This Project

> Mapping từ lý thuyết Pub/Sub sang Terraform thật. Module `pubsub` map từ `docs/architecture/event-flows.md`.

> Liên quan: [IAM & Service Accounts](../iam/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md) · [event-flows.md](../../architecture/event-flows.md)

---

## 1. Chín topic + subscriber

Source: [`infra/modules/pubsub/main.tf`](../../infra/modules/pubsub/main.tf)

```hcl
locals {
  topics = {
    "customer.created"            = { subscriptions = [] }
    "customer.updated"            = { subscriptions = [] }
    "sales-order.submitted"       = { subscriptions = [] }
    "sales-order.confirmed"       = { subscriptions = [] }
    "sales-order.cancelled"       = { subscriptions = ["inventory-service"] }
    "sales-order.fulfilled"       = { subscriptions = ["inventory-service"] }
    "sales-return.goods-received" = { subscriptions = ["inventory-service"] }
    "product.created"             = { subscriptions = ["inventory-service"] }
    "goods.received"              = { subscriptions = ["inventory-service"] }
  }
}
```

| Topic | Subscriber | Ý nghĩa nghiệp vụ |
|---|---|---|
| `customer.created`/`updated` | *(chưa có)* | Tạo sẵn, chưa ai nghe |
| `sales-order.submitted`/`confirmed` | *(chưa có)* | Sẵn cho consumer tương lai |
| `sales-order.cancelled`/`fulfilled` | inventory-service | Đơn huỷ/hoàn tất → điều chỉnh tồn |
| `sales-return.goods-received` | inventory-service | Nhận hàng trả → cộng tồn |
| `product.created` | inventory-service | Sản phẩm mới → khởi tạo bản ghi tồn |
| `goods.received` | inventory-service | Nhập hàng → cộng tồn |

> [!NOTE]
> Nhiều topic `subscriptions = []` là **cố ý** — publish trước, subscriber gắn sau mà không sửa publisher (lợi ích decouple, xem [Overview](./overview.md)).

## 2. `flatten` — sinh subscription động (kỹ thuật HCL)

```hcl
subscriptions = flatten([
  for topic_name, topic in local.topics : [
    for sub in topic.subscriptions : {
      key = "${sub}.${topic_name}", topic_name = topic_name, subscriber = sub
    }
  ]
])
```

Duyệt map lồng list → phẳng hoá để `for_each`. Thêm subscriber = sửa 1 dòng trong `local.topics`, không đụng resource.

## 3. Subscription — ack, retention, dead-letter, retry

```hcl
resource "google_pubsub_subscription" "subs" {
  for_each = { for s in local.subscriptions : s.key => s }
  topic                      = google_pubsub_topic.topics[each.value.topic_name].id
  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"     # 7 ngày
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5                 # fail 5 lần → dead-letter
  }
  retry_policy { minimum_backoff = "10s", maximum_backoff = "600s" }
}
```

| Field | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| `ack_deadline_seconds` | `60` | Consumer có 60s để ack |
| `message_retention_duration` | 7 ngày | Giữ message chưa ack |
| `max_delivery_attempts` | `5` | Sau 5 lần fail → dead-letter |
| `min/max_backoff` | `10s`/`600s` | Backoff tăng dần giữa retry |

## 4. Dead-letter + IAM service agent (bẫy hay quên)

```hcl
resource "google_pubsub_topic" "dead_letter"      { name = "dead-letter" ... }
resource "google_pubsub_subscription" "dead_letter_sub" { ... }

data "google_project" "current" { project_id = var.project_id }
locals {
  pubsub_agent = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}
resource "google_pubsub_topic_iam_member" "dead_letter_publisher" {
  topic  = google_pubsub_topic.dead_letter.name
  role   = "roles/pubsub.publisher"           # agent publish vào dead-letter
  member = local.pubsub_agent
}
resource "google_pubsub_subscription_iam_member" "dead_letter_subscriber" {
  for_each     = google_pubsub_subscription.subs
  subscription = each.value.name
  role         = "roles/pubsub.subscriber"     # agent đọc từ source sub
  member       = local.pubsub_agent
}
```

> [!WARNING]
> **Dead-lettering không tự chạy — cần IAM cho service agent của Google** (`service-<số project>@gcp-sa-pubsub...`), không phải SA app. Agent cần `publisher` trên dead-letter topic + `subscriber` trên mỗi source subscription. **Thiếu 2 grant này → dead-lettering fail âm thầm**, message retry vô hạn. `data "google_project"` dùng để lấy project number ghép email agent. Xem [on-gcp §4](./on-gcp.md) + [IAM on GCP §2](../iam/on-gcp.md).

## 5. Ai publish/consume — quyền từ module IAM

Backend SA (`erp-backend-<env>`) có `roles/pubsub.publisher` + `roles/pubsub.subscriber` ở cấp project → mọi backend service publish/consume được. Xem [IAM in This Project](../iam/in-this-project.md).

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [IAM & Service Accounts](../iam/index.md) · [Cloud Run](../cloud-run/index.md) · [event-flows.md](../../architecture/event-flows.md)
