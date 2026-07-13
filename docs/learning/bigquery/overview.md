---
type: Learning Note
title: "BigQuery Overview"
description: "BigQuery là gì, OLAP vs OLTP, data warehouse, columnar + serverless, tại sao tách analytics khỏi DB giao dịch, so sánh với Cloud SQL / Snowflake / Redshift"
tags: [learning, bigquery, olap, data-warehouse, analytics, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# BigQuery Overview

## Summary

**BigQuery** = **data warehouse serverless** cho **analytics** (OLAP): quét/tổng hợp hàng triệu–tỷ dòng trong giây, dùng Standard SQL, không quản server. Khác hẳn Cloud SQL (OLTP — giao dịch từng dòng). Trong ERP, BigQuery là **lớp báo cáo/analytics** (roadmap, chưa triển khai).

```
   OLTP (Cloud SQL)                    OLAP (BigQuery)
  ┌────────────────────┐             ┌──────────────────────────┐
  │ 1 đơn hàng, 1 khách │             │ "doanh thu theo tháng     │
  │ đọc/ghi từng dòng   │    ──▶      │  × trạng thái × top KH"   │
  │ nhanh, transaction  │   (CDC)     │ quét hàng triệu dòng,    │
  │ (điều hành hằng ngày)│             │  tổng hợp (báo cáo)       │
  └────────────────────┘             └──────────────────────────┘
```

## Key Concepts

### OLTP vs OLAP — hai thế giới khác nhau

| | **OLTP** (Cloud SQL) | **OLAP** (BigQuery) |
|---|---|---|
| Mục đích | Điều hành: đơn hàng, tồn kho | Phân tích: xu hướng, tổng hợp |
| Truy vấn | Đọc/ghi vài dòng, transaction | Quét/tổng hợp hàng triệu dòng |
| Lưu trữ | Row-based (theo dòng) | **Columnar** (theo cột) |
| Tối ưu | Ghi nhanh, khoá, ACID | Đọc phân tích, quét cột |

> [!IMPORTANT]
> **Đừng chạy báo cáo nặng thẳng trên Cloud SQL production.** Query analytics quét cả bảng sẽ khoá/làm chậm DB giao dịch. Giải: **tách** — sao chép dữ liệu sang BigQuery (qua CDC) rồi phân tích ở đó. Đây là lý do kiến trúc ERP dự kiến thêm BigQuery, không nhồi report vào Cloud SQL.

### Vì sao Columnar cho analytics

Query báo cáo thường đọc **vài cột** trên **rất nhiều dòng** (vd `SUM(amount) GROUP BY status`). Lưu **theo cột** → chỉ đọc cột cần, nén tốt → nhanh + rẻ hơn nhiều so với đọc cả dòng.

### Serverless — không quản cluster

BigQuery **không có instance** để bật/tắt. Bạn nạp data + chạy SQL; Google tự cấp compute (slots) lúc query. Trả tiền theo **lượng dữ liệu quét** (on-demand) hoặc **slot** đặt trước.

### So sánh warehouse

| | **BigQuery** | Snowflake | Redshift (AWS) |
|---|---|---|---|
| Managed | ✅ Serverless | ✅ | ✅ (có cluster) |
| Tính tiền | Query/storage tách biệt | Compute/storage tách | Cluster |
| Hệ | GCP native | Đa cloud | AWS |

Dự án ở GCP + cần warehouse cho reporting → **BigQuery** là mặc định tự nhiên (native, free tier rộng).

### Vị trí trong kiến trúc ERP (dự kiến)

```
Cloud SQL (OLTP) ──Datastream CDC──▶ BigQuery (OLAP) ──dbt──▶ marts/metrics ──▶ Looker Studio
   (điều hành)     (~15 min lag)      (raw/staging)            (báo cáo)         (dashboard)
```

Xem chi tiết roadmap: [BigQuery in This Project](./in-this-project.md).

## Practical Application

Dùng BigQuery khi:
- Cần **báo cáo/analytics** trên nhiều dữ liệu (doanh thu, tồn kho theo thời gian).
- Muốn tách tải phân tích khỏi DB giao dịch (Cloud SQL).
- Cần SQL trên dữ liệu lớn mà không quản hạ tầng.

**Không** dùng BigQuery cho:
- Giao dịch điều hành từng dòng (đó là việc của Cloud SQL — OLTP).
- Query độ trễ siêu thấp per-request (BigQuery tối ưu throughput, không phải latency đơn query nhỏ).

## References

- [BigQuery Docs](https://cloud.google.com/bigquery/docs) — tài liệu chính thức
- [Datastream to BigQuery](https://cloud.google.com/datastream/docs) — CDC Cloud SQL → BigQuery
- [OLTP vs OLAP](https://cloud.google.com/learn/what-is-olap) — khác biệt cơ bản

## Related Concepts

- [Core Concepts](./core-concepts.md) — dataset, partition, slot, columnar
- [BigQuery on GCP](./on-gcp.md) — giá, serverless, tích hợp
- [BigQuery in This Project](./in-this-project.md) — roadmap CDC reporting
