---
type: Reference
title: "BigQuery — Troubleshooting & Pitfalls"
description: "Bẫy khi dùng BigQuery: full scan đốt tiền (tính theo bytes quét), thiếu partition, nhầm OLTP, streaming đắt, và bẫy khi thiết kế pipeline CDC reporting"
tags: [bigquery, troubleshooting, pitfalls, cost, partitioning, cdc, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://docs/operations/cdc-reporting-learning-plan.md"
---

# BigQuery — Troubleshooting & Pitfalls

> BigQuery chưa triển khai (xem [in-this-project](./in-this-project.md)); đây là bẫy cần biết **trước khi** dựng, để thiết kế đúng ngay từ đầu.

## 1. Chi phí (bẫy lớn nhất)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| `SELECT *` trên bảng lớn | Quét toàn bộ cột → hoá đơn cao (tính theo **bytes quét**) | Chỉ chọn cột cần |
| Thiếu partition filter | Mỗi query quét cả bảng | Partition theo ngày; luôn lọc partition |
| Không xem "bytes processed" trước | Chạy query đắt bất ngờ | Xem ước tính bytes trước khi chạy; đặt `maximum_bytes_billed` |
| `LIMIT` để "tiết kiệm" | `LIMIT` **không** giảm bytes quét | Giảm bytes = chọn cột + partition, không phải LIMIT |
| Streaming insert lạm dụng | Đắt hơn batch nhiều | Batch load / CDC |

## 2. Thiết kế bảng

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Bảng lớn không partition/cluster | Query chậm + đắt khi data lớn | Partition (ngày) + cluster (cột lọc phổ biến) |
| Quá nhiều bảng trung gian giữ mãi | Storage phình | Dọn bảng tạm; dùng view/materialized view hợp lý |

## 3. Dùng sai công cụ

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Dùng BigQuery như OLTP (ghi/đọc từng dòng) | Chậm, đắt, sai mục đích | OLTP → [Cloud SQL](../cloud-sql/index.md); OLAP → BigQuery |
| Query real-time độ trễ thấp per-request | BigQuery tối ưu throughput, không latency đơn nhỏ | Cache kết quả / dùng metrics table dựng sẵn |

## 4. Bẫy pipeline CDC → Reporting (khi triển khai roadmap)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Kỳ vọng real-time | Datastream có **lag ~15 phút** | Chấp nhận eventual; báo cáo không phải real-time |
| dbt model không test | Data sai lan xuống dashboard | `dbt test` (not_null, unique) từ đầu |
| Schema Cloud SQL đổi | CDC/staging vỡ | Version schema; dbt staging cô lập thay đổi |
| Cấp quyền BigQuery quá rộng | Lộ dữ liệu nhạy cảm | IAM theo dataset; column/row-level security |

## 5. Khi bắt đầu (checklist thiết kế)

- [ ] Partition bảng lớn theo ngày; cluster theo cột lọc
- [ ] `maximum_bytes_billed` để chặn query "cháy"
- [ ] Chỉ SELECT cột cần; tránh `SELECT *`
- [ ] dbt layering raw → staging → marts → metrics + `dbt test`
- [ ] IAM theo dataset (least privilege)
- [ ] Cập nhật [in-this-project](./in-this-project.md) từ roadmap → mapping thật

## Related Concepts

- [BigQuery in This Project](./in-this-project.md) — roadmap CDC reporting
- [Core Concepts](./core-concepts.md) — partition, clustering, bytes quét
- [BigQuery on GCP](./on-gcp.md) — mô hình giá on-demand
