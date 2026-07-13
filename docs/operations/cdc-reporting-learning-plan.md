---
type: Runbook
title: "CDC → Reporting Pipeline — Thin Slice Learning Plan (GCP)"
description: "Plan học CDC → Reporting theo đúng luồng 01-high-level-component.md, thin slice 2 bảng × 4 dbt models × 1 dashboard trên GCP thật"
tags: [runbook, cdc, reporting, bigquery, dbt, datastream, gcp, learning]
timestamp: "2026-07-06T00:00:00+07:00"
diataxis: how-to
---

# CDC → Reporting Pipeline — Thin Slice Learning Plan

> **Nguyên tắc:** Chạy đúng luồng production từ [`01-high-level-component.md`](../../../new-erp-design/architecture-diagrams/01-high-level-component.md), không thay thế component — chỉ thu nhỏ scope data.

---

## Architecture Target (diagram gốc)

```
Cloud SQL → Datastream CDC → BigQuery → dbt → Semantic Layer → Dashboards
```

## Thin Slice: 2 bảng × 4 models × 1 dashboard

Thay vì 8 context × 25+ models, thin slice chọn **2 bảng đại diện** từ prototype để chạy toàn bộ pipeline end-to-end:

```
Cloud SQL (sales.headers + customer.cores)
    ↓ Datastream CDC (~15 min lag)
BigQuery raw dataset (auto-replicated)
    ↓ dbt run
  stg_orders → fct_orders + dim_customer → metrics_revenue
    ↓
Looker Studio dashboard (revenue by status, top customers)
```

---

## Pipeline Components

### Step 1 — Cloud SQL (source)

| Item | Chi tiết |
|---|---|
| **Đã có** | Prototype Cloud SQL instance (Supabase PostgreSQL) |
| **Bảng dùng** | `sales.headers`, `sales.lines`, `customer.cores` |
| **Việc cần làm** | Đảm bảo instance có data (seed hoặc dùng data từ E2E tests) |
| **Chi phí** | $0 (đã có) |

> Tham khảo config: [run-backend-with-prod-config.md](./run-backend-with-prod-config.md)

---

### Step 2 — Datastream CDC (Cloud SQL → BigQuery)

| Item | Chi tiết |
|---|---|
| **Công nghệ** | GCP Datastream — managed CDC service |
| **Vai trò** | Near-real-time replication Cloud SQL → BigQuery raw layer (~15 min lag) |
| **Scope** | 1 stream, chỉ capture 3 bảng: `sales.headers`, `sales.lines`, `customer.cores` |
| **Config** | GCP Console hoặc Terraform |
| **Chi phí** | ~$0.10/GB processed (pennies cho data nhỏ) |

**Cần setup:**
1. Enable Datastream API trong GCP project
2. Tạo connection profile cho Cloud SQL (source) và BigQuery (destination)
3. Tạo stream: chọn 3 bảng → destination BigQuery dataset `raw`
4. Start stream, chờ initial backfill → verify data xuất hiện trong BigQuery

**Học được:** CDC concept, logical replication, schema mapping, backfill vs ongoing changes.

---

### Step 3 — BigQuery (OLAP / Lakehouse)

| Item | Chi tiết |
|---|---|
| **Công nghệ** | BigQuery |
| **Datasets** | `raw` (auto từ Datastream), `staging`, `marts`, `metrics` (dbt tạo) |
| **Chi phí** | Free tier: 1TB query/month, 10GB storage |

**Cần setup:**
1. Tạo BigQuery datasets: `raw` (Datastream destination), `staging`, `marts`, `metrics`
2. Verify data trong `raw` sau khi Datastream chạy
3. Explore data bằng BigQuery Console — chạy vài query cơ bản

**Học được:** BigQuery UI, SQL dialect (Standard SQL), dataset/table structure, partitioning concept.

---

### Step 4 — dbt (data transformation)

| Item | Chi tiết |
|---|---|
| **Công nghệ** | dbt-core (miễn phí) + `dbt-bigquery` adapter |
| **Models** | 4 models thin slice (bên dưới) |
| **Chi phí** | $0 (dbt-core OSS, queries dùng BigQuery free tier) |

**dbt project structure:**

```
dbt-erp-reporting/
├── dbt_project.yml
├── profiles.yml                        # BigQuery connection (service account key)
├── models/
│   ├── staging/
│   │   └── stg_orders.sql              # Clean + join headers + lines từ raw
│   ├── marts/
│   │   ├── fct_orders.sql              # Fact: 1 row per order, enriched
│   │   └── dim_customer.sql            # Dimension: customer master
│   └── metrics/
│       └── revenue_summary.sql         # Revenue grouped by status/month
├── models/schema.yml                   # Source definitions + tests
└── packages.yml                        # (optional) dbt_utils
```

**4 models chi tiết:**

```sql
-- staging/stg_orders.sql
-- Join sales.headers + sales.lines từ raw, clean types, rename columns

-- marts/fct_orders.sql
-- 1 row per order: order_id, customer_id, status, total_amount, line_count,
-- created_at, updated_at. ref('stg_orders') + ref('dim_customer')

-- marts/dim_customer.sql
-- Customer enriched: id, name, email, credit_limit, created_at
-- source('raw', 'customer_cores')

-- metrics/revenue_summary.sql
-- Revenue by status by month. ref('fct_orders') group by
```

**Workflow:**
1. `dbt init` → config `profiles.yml` (BigQuery service account)
2. Định nghĩa `sources` trong `schema.yml` (trỏ raw dataset)
3. Viết 4 models theo thứ tự staging → marts → metrics
4. `dbt run` → verify tables xuất hiện trong BigQuery
5. `dbt test` → viết 2–3 basic tests (not_null, unique)
6. `dbt docs generate && dbt docs serve` → xem DAG lineage

**Học được:** `ref()`, `source()`, staging/marts/metrics layering, incremental models concept, testing, documentation, DAG lineage.

---

### Step 5 — Semantic Layer + Dashboard

| Item | Chi tiết |
|---|---|
| **Công nghệ** | Looker Studio (free, native GCP) |
| **Data source** | BigQuery `metrics.revenue_summary` + `marts.fct_orders` |
| **Chi phí** | $0 |

> **Tại sao Looker Studio thay Lightdash/Cube:** Diagram gốc note "Lightdash / Cube / Looker" — cả 3 là options. Looker Studio = free + native GCP + zero setup. Thin slice dùng Looker Studio trước; scale lên Lightdash/Cube khi cần semantic layer phức tạp hơn (KPI definitions, drill-down, scheduled email).

**Cần setup:**
1. Mở Looker Studio → New Report → BigQuery connector
2. Chọn `metrics.revenue_summary` làm data source
3. Tạo 2–3 charts:
   - Bar chart: Revenue by order status
   - Time series: Revenue by month
   - Table: Top customers by total spend (từ `fct_orders`)
4. Publish dashboard

**Học được:** BI tool workflow, BigQuery integration, chart types, filter/drill-down basics.

---

## Tổng chi phí ước tính

| Component | Chi phí/tháng |
|---|---|
| Cloud SQL | $0 (đã có) |
| Datastream | < $1 (data nhỏ) |
| BigQuery | $0 (free tier) |
| dbt-core | $0 (OSS) |
| Looker Studio | $0 |
| **Tổng** | **< $1/tháng** |

---

## Mở rộng sau khi vững

| Khi đã vững thin slice | Mở rộng |
|---|---|
| 2 bảng Datastream | → Thêm inventory, purchasing, catalog (all 6 schemas) |
| 4 dbt models | → 25+ models theo [07-kpi-layer-architecture.md](../../../new-erp-design/architecture-diagrams/07-kpi-layer-architecture.md) |
| Looker Studio | → Lightdash / Cube (semantic layer, KPI definitions, scheduled email PDF) |
| Chỉ query | → BigQuery ML (anomaly detection, forecasting) |
| Manual dbt run | → Scheduled dbt (Cloud Run Job / Cloud Composer) |

---

## Related Concepts

- [01 — High-Level Component](../../../new-erp-design/architecture-diagrams/01-high-level-component.md) — architecture diagram gốc
- [07 — KPI Layer Architecture](../../../new-erp-design/architecture-diagrams/07-kpi-layer-architecture.md) — full reporting layer design
- [Prototype vs New Design Gap](../gap/prototype-vs-newdesign-cdc-gap.md) — gap analysis tổng thể
- [Skill Assessment Roadmap](../learning/skill-assessment-roadmap.md) — Track C Data/Analytics (C1–C5)
- [Implementation Status](./implementation-status.md) — trạng thái OLTP prototype
