---
type: Concept Explanation
title: "Cloud Run on GCP"
description: "Đặc thù GCP: execution environment gen1/gen2, mô hình giá (request + CPU + memory), min-instances, startup CPU boost, API v1 vs v2, VPC egress connector vs direct"
tags: [cloud-run, gcp, pricing, vpc-egress, cpu-boost, gen2]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Run on GCP

## Định nghĩa

Những đặc thù GCP bạn phải biết để tune đúng và không bị hoá đơn bất ngờ.

## Cách hoạt động

### 1. Execution Environment: gen1 vs gen2

| | Gen1 | Gen2 |
|---|---|---|
| Cold start | Nhanh hơn | Chậm hơn chút |
| CPU/Network | Giới hạn | Đầy đủ (full Linux compat) |
| Mount filesystem | Không | Có (network FS) |
| Hợp cho | App nhẹ, cold-start nhạy | App cần syscall đầy đủ |

Mặc định gen2 cho v2 service. Đa số microservice không cần bận tâm — chỉ đổi khi gặp giới hạn cụ thể.

### 2. Mô hình giá — hiểu để không "cháy túi"

Cloud Run tính tiền trên 3 trục **chỉ khi instance đang sống**:

```
Chi phí ≈ (CPU-giây) + (Memory-giây) + (số request) + (network egress)
```

| Chế độ CPU | Khi nào tính CPU | Hợp cho |
|---|---|---|
| **CPU chỉ khi xử lý request** (mặc định) | Chỉ lúc có request đang chạy | Request-response thuần → rẻ nhất |
| **CPU luôn bật (always-allocated)** | Suốt vòng đời instance | Background task, streaming, giữ kết nối |

> [!IMPORTANT]
> **Scale-to-zero + CPU-theo-request = rẻ nhất.** Idle → 0 instance → $0. Nhưng nếu đặt `min_instances > 0`, bạn trả tiền cho instance nóng **24/7** (memory luôn tính; CPU tuỳ chế độ). Đây là đánh đổi tiền ⇄ cold start.

Ngoài ra GCP có **free tier** hàng tháng (số request + vCPU-giây + GiB-giây miễn phí) — đủ cho môi trường dev nhỏ gần như $0.

### 3. Min instances — diệt cold start bằng tiền

```
min_instances = 0   → $0 khi idle, nhưng request đầu chịu cold start
min_instances = 1   → 1 instance nóng 24/7 → không cold start → trả tiền đều
```

Chiến lược thực dụng: service **nóng, nhạy latency** (gateway, auth) có thể đặt `min=1`; service ít gọi để `min=0`.

### 4. Startup CPU boost

Tạm cấp thêm CPU **trong lúc khởi động** để container boot nhanh hơn → giảm cold start mà không phải giữ instance nóng. Gần như luôn nên bật cho app boot nặng (JVM, Node lớn).

### 5. API v1 vs v2

| | `google_cloud_run_service` (v1) | `google_cloud_run_v2_service` (v2) |
|---|---|---|
| API | Knative-style (annotations) | Native, rõ ràng, dễ đọc |
| Khuyến nghị | Legacy | **Dùng cho mới** |

> Dự án dùng **v2** (`google_cloud_run_v2_service`) — cú pháp `template { containers { ... } }` tường minh thay vì annotation.

### 6. VPC Egress: Connector vs Direct

Để Cloud Run chạm tài nguyên **private** (Cloud SQL private IP), traffic phải vào VPC. Hai cách:

| | **Serverless VPC Access Connector** | **Direct VPC Egress** (mới hơn) |
|---|---|---|
| Cơ chế | VM trung gian (e2-micro ×2-3) | Cloud Run gắn thẳng NIC vào subnet |
| Chi phí | Trả tiền VM connector 24/7 (~$7/mo) | Không VM trung gian |
| Cấu hình dự án | **Đang dùng Connector** | (đường nâng cấp tương lai) |

Cả hai đều có tham số **egress**:

| `egress` | Nghĩa |
|---|---|
| `PRIVATE_RANGES_ONLY` | Chỉ traffic tới IP private (10.x/172.16.x/192.168.x) đi qua VPC; internet đi thẳng |
| `ALL_TRAFFIC` | Mọi traffic ra đều qua VPC (dùng khi cần NAT IP cố định) |

> Dự án đặt `egress = PRIVATE_RANGES_ONLY` → chỉ traffic tới Cloud SQL private đi qua connector; gọi API internet đi thẳng (nhanh, không tốn băng thông connector). Chi tiết đường đi: [VPC in This Project](../vpc/vpc-in-this-project.md).

### 7. Ingress — ai gọi được service

| `ingress` | Ai gọi được |
|---|---|
| `INGRESS_TRAFFIC_ALL` | Bất kỳ (kể cả internet) — cho gateway, frontend |
| `INGRESS_TRAFFIC_INTERNAL_ONLY` | Chỉ trong VPC/project (qua LB nội bộ / VPC) — cho 6 backend |

> [!IMPORTANT]
> **Ingress (mạng) ≠ IAM invoker (danh tính).** Ingress kiểm soát *traffic từ đâu tới*; IAM `roles/run.invoker` kiểm soát *danh tính nào được gọi*. Backend private trong dự án khoá **cả hai**: `internal-only` + chỉ SA gateway có invoker. Xem [IAM](../iam/index.md).

## Ví dụ thực tế

Tuning một service nóng (api-gateway) vs một service ít gọi (purchasing):

```
api-gateway:   min=1, CPU boost on, concurrency 80, ingress=all         → không cold start
purchasing:    min=0, concurrency 80, ingress=internal-only             → $0 khi idle
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Hoá đơn cao bất ngờ | `min_instances>0` nhiều service | Chỉ giữ nóng service thật cần |
| Không chạm được Cloud SQL private | Thiếu VPC egress / sai `egress` | Gắn connector + `PRIVATE_RANGES_ONLY` |
| Gọi API internet chậm khi có connector | `egress=ALL_TRAFFIC` ép hết qua VM | Đổi về `PRIVATE_RANGES_ONLY` |
| Backend bị gọi thẳng từ ngoài | Để `ingress=all` | Đặt `internal-only` cho backend |

## Related Concepts

- [Core Concepts](./core-concepts.md) — scaling, cold start
- [Cloud Run in This Project](./in-this-project.md) — cấu hình thật
- [VPC in This Project](../vpc/vpc-in-this-project.md) — connector & egress path
