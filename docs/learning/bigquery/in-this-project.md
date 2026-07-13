---
type: Reference
title: "BigQuery in This Project"
description: "BigQuery CHƯA triển khai trong ERP — đây là lớp analytics/reporting dự kiến (roadmap): Cloud SQL → Datastream CDC → BigQuery → dbt → Looker Studio, theo cdc-reporting-learning-plan.md"
tags: [bigquery, roadmap, erp, gcp, cdc, datastream, dbt, reporting]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://docs/operations/cdc-reporting-learning-plan.md"
---

# BigQuery in This Project

> [!IMPORTANT]
> **BigQuery CHƯA được triển khai** trong ERP hiện tại — không có Terraform module, không có code, không có dataset đang chạy. Doc này ghi lại **lớp analytics/reporting dự kiến** (roadmap), theo kế hoạch [`cdc-reporting-learning-plan.md`](../../operations/cdc-reporting-learning-plan.md). Ghi ở đây để nhất quán với các bundle khác và để khi triển khai thì cập nhật thẳng vào đây (code là nguồn sự thật — nếu mai bạn thấy dataset thật, sửa doc này).

> Liên quan: [Cloud SQL](../cloud-sql/index.md) (nguồn OLTP) · [cdc-reporting-learning-plan.md](../../operations/cdc-reporting-learning-plan.md)

---

## 1. Vì sao chưa dùng (và khi nào nên thêm)

ERP hiện là **OLTP prototype** — điều hành (đơn hàng, tồn kho) trên Cloud SQL. Analytics/reporting là nhu cầu **sau**, chưa xuất hiện triệu chứng đau (chưa có báo cáo nặng làm chậm DB). Theo tinh thần YAGNI của dự án, BigQuery được **thiết kế trước, triển khai khi cần** — không dựng sớm.

**Triệu chứng nên thêm BigQuery:**
- Báo cáo/dashboard bắt đầu chạy query nặng trên Cloud SQL → làm chậm giao dịch.
- Cần tổng hợp lịch sử nhiều tháng/năm mà OLTP không kham.

## 2. Kiến trúc dự kiến (từ learning plan)

Source: [`docs/operations/cdc-reporting-learning-plan.md`](../../operations/cdc-reporting-learning-plan.md)

```
Cloud SQL → Datastream CDC → BigQuery → dbt → Semantic Layer → Dashboards
 (OLTP)      (~15 min lag)    (OLAP)     (transform)  (Looker Studio)
```

**Thin slice** đề xuất (2 bảng × 4 dbt model × 1 dashboard):

```
Cloud SQL (sales.headers + customer.cores)
   ↓ Datastream CDC
BigQuery raw dataset
   ↓ dbt run
 stg_orders → fct_orders + dim_customer → revenue_summary
   ↓
Looker Studio (revenue by status, top customers)
```

## 3. Datasets dự kiến (dbt layering)

| Dataset | Nguồn | Vai trò |
|---|---|---|
| `raw` | Datastream (auto) | Bản sao thô từ Cloud SQL |
| `staging` | dbt | Làm sạch, rename, join headers+lines |
| `marts` | dbt | `fct_orders` (fact), `dim_customer` (dimension) |
| `metrics` | dbt | `revenue_summary` (tổng hợp cho dashboard) |

## 4. Vai trò từng thành phần

| Bước | Công nghệ | Ghi chú |
|---|---|---|
| Source | **Cloud SQL** | Đã có; bảng `sales.headers/lines`, `customer.cores` |
| CDC | **Datastream** | Managed CDC, ~15 min lag, ~$0.10/GB |
| Warehouse | **BigQuery** | Free tier: 1TB query + 10GB storage/tháng |
| Transform | **dbt** (`dbt-bigquery`) | staging → marts → metrics (OSS, $0) |
| Dashboard | **Looker Studio** | Native GCP, free |

**Tổng chi phí ước tính**: < $1/tháng (data nhỏ, free tier).

## 5. Khi triển khai — provision thế nào

Learning plan gợi ý qua GCP Console hoặc Terraform. Nếu theo chuẩn dự án (IaC), khi làm thật nên:
- Thêm module Terraform `bigquery` (datasets raw/staging/marts/metrics) + `datastream` (stream 3 bảng).
- Cấp IAM cho Datastream + dbt service account (`bigquery.dataEditor`, `jobUser`).
- Cập nhật doc này từ "roadmap" thành mapping code thật.

> [!NOTE]
> Mở rộng sau thin slice (theo plan): thêm 6 schema còn lại, 25+ dbt model, chuyển Looker Studio → Lightdash/Cube, thêm BigQuery ML (forecast/anomaly), scheduled dbt (Cloud Run Job / Composer).

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [cdc-reporting-learning-plan.md](../../operations/cdc-reporting-learning-plan.md) — kế hoạch đầy đủ
- [Cloud SQL in This Project](../cloud-sql/in-this-project.md) — nguồn OLTP
