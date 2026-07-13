---
type: Concept Explanation
title: "BigQuery Core Concepts"
description: "Building blocks: Dataset/Table, columnar storage, Partitioning, Clustering, Slots, Standard SQL, batch load vs streaming, materialized views"
tags: [bigquery, dataset, partitioning, clustering, slots, columnar, sql]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# BigQuery Core Concepts

## Định nghĩa

BigQuery xây trên vài khái niệm cốt lõi. Nắm chúng = query nhanh và **không đốt tiền** (query tính theo dữ liệu quét).

## Tại sao quan trọng

Không hiểu partition/clustering → mỗi query quét cả bảng → chậm + đắt. Không hiểu slots → không biết vì sao query xếp hàng.

## Cách hoạt động

### 1. Dataset & Table

- **Dataset**: nhóm bảng (như "schema"/namespace). Có location (region).
- **Table**: bảng dữ liệu. Cũng có **view**, **materialized view**, **external table**.

```
Project
 └── Dataset `raw`      → bảng từ Datastream (sales_headers, customer_cores...)
 └── Dataset `staging`  → bảng dbt làm sạch
 └── Dataset `marts`    → fact/dimension
 └── Dataset `metrics`  → bảng tổng hợp cho dashboard
```

### 2. Columnar storage — nền tảng tốc độ

Lưu **theo cột**: query chỉ đọc cột cần → nhanh + nén tốt. `SELECT SUM(amount)` chỉ đọc cột `amount`, không đọc cả dòng.

> [!TIP]
> Vì tính tiền theo **cột quét**, `SELECT *` trên bảng lớn rất đắt. Chỉ chọn cột cần. Đây là phản xạ quan trọng nhất khi dùng BigQuery.

### 3. Partitioning — chia bảng theo thời gian/cột

Chia bảng thành **phân vùng** (thường theo ngày). Query lọc theo partition chỉ quét phần liên quan → rẻ hơn nhiều.

```sql
-- Bảng partition theo ngày; query 1 tháng chỉ quét ~30 partition, không cả bảng
SELECT ... FROM orders WHERE _PARTITIONDATE BETWEEN '2026-06-01' AND '2026-06-30'
```

### 4. Clustering — sắp xếp trong partition

Sắp dữ liệu theo cột hay lọc (vd `status`, `customer_id`) → BigQuery bỏ qua block không liên quan → quét ít hơn nữa.

> [!IMPORTANT]
> **Partition + Clustering là hai đòn bẩy chi phí lớn nhất.** Bảng lớn không partition → mỗi query quét toàn bộ → hoá đơn tăng nhanh. Thiết kế partition theo cột lọc phổ biến (thường là ngày).

### 5. Slots — đơn vị compute

**Slot** = đơn vị năng lực tính toán. Query dùng slot lúc chạy. Hai mô hình: **on-demand** (Google tự cấp, tính theo data quét) hoặc **reservation** (đặt slot trước, giá cố định). Xem [on-gcp](./on-gcp.md).

### 6. Standard SQL

BigQuery dùng **GoogleSQL** (Standard SQL): JOIN, window function, CTE, array/struct. Quen thuộc với ai biết SQL; có thêm kiểu lồng (nested/repeated).

### 7. Nạp dữ liệu: batch load vs streaming

| Cách | Khi nào |
|---|---|
| **Batch load** | Nạp file/bảng lớn định kỳ (rẻ) |
| **Streaming insert** | Ghi từng dòng gần real-time (đắt hơn) |
| **CDC (Datastream)** | Replicate liên tục từ DB nguồn (dự án dự kiến) |

### 8. Materialized view

View được **lưu vật lý** + tự cập nhật → tăng tốc query tổng hợp lặp lại (đánh đổi storage + refresh cost).

## Ví dụ thực tế (theo roadmap)

```sql
-- metrics.revenue_summary: doanh thu theo trạng thái theo tháng
SELECT
  DATE_TRUNC(created_at, MONTH) AS month,
  status,
  SUM(total_amount) AS revenue
FROM marts.fct_orders
GROUP BY month, status
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Query rất đắt | `SELECT *` / thiếu partition filter | Chọn cột cần; lọc partition |
| Query chậm dần khi data lớn | Bảng không partition/cluster | Thêm partition (ngày) + cluster (cột lọc) |
| Streaming insert tốn tiền | Ghi từng dòng liên tục | Batch load hoặc CDC thay vì streaming thủ công |
| Nhầm BigQuery cho OLTP | Dùng như DB giao dịch | OLTP → Cloud SQL; OLAP → BigQuery |

## Related Concepts

- [Overview](./overview.md) — OLAP vs OLTP, columnar
- [BigQuery on GCP](./on-gcp.md) — giá on-demand vs slots
- [BigQuery in This Project](./in-this-project.md) — roadmap datasets raw/staging/marts/metrics
