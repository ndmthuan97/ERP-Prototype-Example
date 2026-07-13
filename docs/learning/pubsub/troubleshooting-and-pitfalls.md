---
type: Reference
title: "Pub/Sub — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: xử lý trùng (idempotency), dead-letter fail âm thầm, ack deadline, nhiều sub không chia tải, message mất"
tags: [pubsub, troubleshooting, pitfalls, idempotency, dead-letter, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/pubsub/main.tf"
---

# Pub/Sub — Troubleshooting & Pitfalls

> Tra cứu nhanh khi message trùng, kẹt, hoặc dead-letter không hoạt động.

## 1. Trùng lặp & thứ tự

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Xử lý trùng (trừ kho 2 lần) | At-least-once + consumer không idempotent | Dedupe theo message-id / order-id |
| Message xử lý sai thứ tự | Không bật ordering (mặc định) | Bật `ordering_key` nếu cần (đánh đổi throughput) |
| Message gửi lại giữa chừng | Xử lý lâu hơn `ack_deadline=60s` | Tăng deadline hoặc extend khi đang xử lý |

## 2. Dead-letter

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Message lỗi retry vô hạn, không vào dead-letter | **Service agent thiếu quyền** | Cấp `publisher` (dead-letter topic) + `subscriber` (source sub) cho `service-<num>@gcp-sa-pubsub` |
| Dead-letter đầy message | Consumer lỗi logic → fail 5 lần liên tục | Soi `dead-letter-sub`, sửa consumer, replay |

## 3. Phân phối & tải

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Tạo thêm sub nhưng không nhanh hơn | Mỗi sub nhận bản đầy đủ, không chia tải | Chia tải = nhiều consumer trên **1** sub |
| Consumer quá tải | Publish nhanh hơn xử lý | Thêm consumer (cùng sub); dùng pull điều tiết |

## 4. Message "mất"

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Publish nhưng không ai nhận | Không có subscription lúc publish | Tạo sub trước; hoặc đó là chủ đích (topic chưa có consumer) |
| Message biến mất sau 7 ngày | Chưa ack trong `message_retention_duration` | Xử lý kịp; tăng retention |

## 5. Quyền

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Publish/consume bị `403` | Backend SA thiếu `pubsub.publisher`/`subscriber` | Cấp role ([IAM in This Project](../iam/in-this-project.md)) |
| Push endpoint 401/403 | Thiếu OIDC / invoker cho push | Cấp `run.invoker`; cấu hình OIDC token |

## 6. Debug nhanh

```bash
# Liệt kê topic & subscription
gcloud pubsub topics list --project=<project_id>
gcloud pubsub subscriptions list --project=<project_id>

# Kiểm IAM của dead-letter topic (service agent có publisher?)
gcloud pubsub topics get-iam-policy dead-letter --project=<project_id>

# Kéo thử message từ dead-letter để soi
gcloud pubsub subscriptions pull dead-letter-sub --auto-ack --limit=10 --project=<project_id>
```

## Related Concepts

- [Pub/Sub in This Project](./in-this-project.md) — topology + IAM service agent
- [Core Concepts](./core-concepts.md) — ack, at-least-once, dead-letter
- [Pub/Sub on GCP](./on-gcp.md) — push vs pull, service agent
