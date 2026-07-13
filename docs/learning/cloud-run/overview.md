---
type: Learning Note
title: "Cloud Run Overview"
description: "Serverless container là gì, tại sao chọn Cloud Run, so sánh với GKE / Cloud Functions / App Engine và cross-cloud"
tags: [learning, cloud-run, serverless, container, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Run Overview

## Summary

**Cloud Run** = chạy **container** mà **không phải quản lý server**. Bạn đưa 1 Docker image → Google lo scaling (kể cả scale-to-zero), HTTPS, load balancing, health check. Trả tiền **theo request + thời gian CPU thực chạy** — không request thì gần như $0.

```
      Bạn đưa vào                Google lo hết               Bạn nhận
  ┌──────────────────┐      ┌────────────────────┐      ┌──────────────┐
  │  Docker image     │─────▶│ Scaling (0→N)      │─────▶│  1 URL HTTPS │
  │  (nghe PORT)      │      │ TLS, LB, health     │      │  tự co giãn  │
  └──────────────────┘      │ patching hạ tầng    │      └──────────────┘
                            └────────────────────┘
```

Bên dưới Cloud Run là **Knative** (serverless trên Kubernetes) nhưng bạn **không thấy** cluster, node, hay pod — đó chính là điểm hấp dẫn.

## Key Concepts

### Tại sao dùng Cloud Run?

| Vấn đề | Tự quản VM / K8s | Cloud Run |
|---|---|---|
| **Scaling** | Tự cấu hình autoscaler, giữ node chạy | Tự động 0→N theo request |
| **Chi phí lúc rảnh** | Trả tiền VM 24/7 dù không ai dùng | Scale-to-zero → ~$0 khi idle |
| **Vận hành** | Patch OS, quản node, cập nhật K8s | Google lo toàn bộ hạ tầng |
| **Deploy** | Pipeline phức tạp | Push image → deploy 1 lệnh |
| **HTTPS/LB** | Tự dựng | Có sẵn, cấp URL + cert tự động |

### "Serverless" nghĩa là gì?

Không phải "không có server" — mà là **bạn không quản server**. Đánh đổi: mất một phần kiểm soát (không SSH vào máy, giới hạn thời gian request, stateless bắt buộc) để đổi lấy vận hành gần bằng 0.

### Cloud Run so với các lựa chọn compute khác trên GCP

| Tiêu chí | Cloud Functions | **Cloud Run** | App Engine | GKE |
|---|---|---|---|---|
| Đơn vị deploy | 1 function | **Container** | App (runtime cố định) | Container + K8s |
| Ngôn ngữ | Giới hạn runtime | **Bất kỳ (Docker)** | Giới hạn runtime | Bất kỳ |
| Scale-to-zero | ✅ | ✅ | Chỉ Standard | ❌ (node luôn chạy) |
| Kiểm soát hạ tầng | Thấp nhất | **Vừa phải** | Thấp | Cao nhất |
| Độ phức tạp vận hành | Thấp | **Thấp** | Thấp | Cao |
| Hợp cho | Event nhỏ, glue code | **API / microservice** | Web app đơn khối | Hệ phức tạp, cần K8s |

> [!IMPORTANT]
> **Cloud Run là điểm cân bằng "vừa phải"**: linh hoạt hơn Functions (chạy *bất kỳ* container), đơn giản hơn GKE (không phải quản K8s). Đây là lý do nó là compute mặc định cho microservice trong dự án này (8 service).

### Cross-cloud — mental model giống nhau

| Khái niệm | GCP | AWS | Azure |
|---|---|---|---|
| Serverless container | **Cloud Run** | App Runner / ECS Fargate | Container Apps |
| Serverless function | Cloud Functions | Lambda | Functions |
| Managed K8s | GKE | EKS | AKS |

### Vị trí trong kiến trúc ERP

```
Internet
   │
   ▼
api-gateway-dev (Cloud Run, public) ── proxy ──▶ 6 backend (Cloud Run, internal-only)
   │                                                    │
frontend-dev (Cloud Run, public)                        ▼
                                              Cloud SQL / Pub/Sub / Secret Manager
```

Cloud Run là **lớp compute** — nơi code thực sự chạy. Stateless: mọi state đẩy ra Cloud SQL (DB), Upstash Redis (cache), Pub/Sub (event).

## Practical Application

Chọn Cloud Run khi:
- Có sẵn container (hoặc dựng được Dockerfile) và muốn 1 URL HTTPS tự co giãn.
- Tải lên xuống thất thường → muốn scale-to-zero để tiết kiệm.
- Là API / microservice HTTP request-response (không phải job chạy nền dài hạn — dù Cloud Run Jobs có hỗ trợ batch).

Cân nhắc khác khi:
- Cần state cục bộ / kết nối lâu dài / control plane K8s → GKE.
- Chỉ vài dòng glue theo event → Cloud Functions.

## References

- [Cloud Run Docs](https://cloud.google.com/run/docs) — tài liệu chính thức
- [Cloud Run Container Contract](https://cloud.google.com/run/docs/container-contract) — hợp đồng container phải tuân
- [Knative](https://knative.dev/) — nền tảng bên dưới

## Related Concepts

- [Core Concepts](./core-concepts.md) — service, revision, concurrency, scaling
- [Cloud Run on GCP](./on-gcp.md) — giá & tuning đặc thù GCP
- [Cloud Run in This Project](./in-this-project.md) — áp dụng thực tế
