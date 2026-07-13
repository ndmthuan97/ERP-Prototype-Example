---
type: Concept Explanation
title: "BigQuery on GCP"
description: "Đặc thù GCP: kiến trúc serverless (tách storage/compute), mô hình giá on-demand vs slot reservation, free tier, federated query, BigQuery ML, tích hợp Datastream/Looker"
tags: [bigquery, gcp, pricing, slots, serverless, datastream, looker, bqml]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# BigQuery on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách BigQuery tính tiền (dễ "cháy" nếu không hiểu) và tích hợp với phần còn lại.

## Cách hoạt động

### 1. Kiến trúc serverless — tách storage & compute

BigQuery **tách** lưu trữ (storage) khỏi tính toán (compute). Không có cluster để bật/tắt; query tự cấp compute (slots). Storage tính riêng, rẻ; compute tính theo query.

### 2. Mô hình giá — điểm dễ "cháy" nhất

```
Chi phí ≈ (compute: on-demand THEO DATA QUÉT, hoặc slot đặt trước)
        + (storage: GB lưu, active vs long-term)
        + (streaming insert nếu dùng)
```

| Mô hình compute | Cách tính | Khi nào |
|---|---|---|
| **On-demand** | Theo **lượng dữ liệu quét** mỗi query | Mặc định, tải thất thường |
| **Slot reservation** | Đặt slot trước, giá cố định/tháng | Tải lớn, ổn định, muốn kiểm soát chi phí |

> [!WARNING]
> **On-demand tính theo BYTES QUÉT, không phải số dòng trả về.** Một `SELECT *` trên bảng 1TB quét 1TB dù `LIMIT 10`. Phản xạ sống còn: **chọn cột cần** + **lọc partition** + xem "bytes processed" ước tính trước khi chạy. Đây là nguồn hoá đơn bất ngờ phổ biến nhất của BigQuery.

### 3. Free tier

- **Query**: 1 TB dữ liệu quét **miễn phí/tháng**.
- **Storage**: 10 GB miễn phí.

→ Thin slice ERP (data nhỏ) gần như **$0** — phù hợp học/thử nghiệm.

### 4. Federated & external queries

Query dữ liệu **ngoài** BigQuery storage: external table trên Cloud Storage, hoặc federated query tới Cloud SQL. Hữu ích để nối dữ liệu mà không copy — nhưng chậm hơn native storage.

### 5. BigQuery ML (BQML)

Train model ML **bằng SQL** ngay trong BigQuery (forecast, anomaly detection, phân loại). Không cần export data. Là hướng mở rộng sau của roadmap reporting.

### 6. Tích hợp trong hệ GCP

| Tích hợp | Vai trò |
|---|---|
| **Datastream** | CDC Cloud SQL → BigQuery `raw` (~15 min lag) |
| **dbt** (`dbt-bigquery`) | Transform raw → staging → marts → metrics |
| **Looker Studio** | Dashboard đọc thẳng BigQuery (native, free) |
| **Scheduled queries / Cloud Composer** | Chạy transform định kỳ |

### 7. Bảo mật & IAM

Phân quyền theo dataset/table qua IAM (`bigquery.dataViewer`, `dataEditor`, `jobUser`...). Có thể column/row-level security cho dữ liệu nhạy cảm.

## Ví dụ thực tế (roadmap)

```
Datastream: Cloud SQL → BigQuery dataset `raw` (3 bảng, ~15 min lag)
dbt-bigquery: raw → staging → marts → metrics (free-tier queries)
Looker Studio: đọc metrics.revenue_summary → dashboard
Chi phí ước tính: < $1/tháng (data nhỏ, free tier)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Hoá đơn query tăng vọt | `SELECT *` / thiếu partition filter (tính theo bytes quét) | Chọn cột; lọc partition; xem "bytes processed" trước |
| Query xếp hàng chậm | Hết slot (reservation nhỏ) | Tăng reservation hoặc dùng on-demand |
| Storage phình | Giữ nhiều bảng trung gian | Xoá bảng tạm; long-term storage tự rẻ dần |
| Streaming đắt bất ngờ | Dùng streaming insert khi không cần | Batch load / CDC thay thế |

## Related Concepts

- [Core Concepts](./core-concepts.md) — partition, clustering, slots
- [BigQuery in This Project](./in-this-project.md) — roadmap CDC reporting
- [Cloud SQL on GCP](../cloud-sql/on-gcp.md) — nguồn OLTP của CDC
