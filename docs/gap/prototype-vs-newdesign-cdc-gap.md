---
type: Reference
title: "Prototype vs New ERP Design — CDC & Reporting Gap Analysis"
description: "So sánh trạng thái implement giữa erp-prototype-example (OLTP core) và new-erp-design (CDC + analytics pipeline)"
tags: [reference, gap-analysis, prototype, cdc, reporting, analytics, new-erp]
timestamp: "2026-07-06T00:00:00+07:00"
diataxis: reference
---

# Prototype vs New ERP Design — CDC & Reporting Gap Analysis

> **Mục đích:** Đánh giá prototype example đã hoàn thành những gì so với kiến trúc target trong `new-erp-design/`, tập trung vào phần **CDC → Reporting** (analytics pipeline).

---

## 1. Prototype Example — đã hoàn thành (OLTP Core)

> Nguồn: [IMPLEMENTATION-STATUS.md](../operations/implementation-status.md), [flows.md](../operations/flows.md)

Prototype là **learning project** tập trung microservice patterns. Đã hoàn thành đầy đủ 6 services + gateway + frontend:

| Layer | Status | Chi tiết |
|---|:---:|---|
| Auth / Identity | ✅ | JWT login/refresh/logout, RBAC, rate limiting, Helmet |
| Customer CRUD | ✅ | DDD 4 layers, Outbox, Redis cache (Zod-validated) |
| Catalog CRUD | ✅ | Product + taxRate (VN rates: 0/5/8/10%) |
| Inventory | ✅ | Reserve/release batch, optimistic locking (version + retry), decimal qty |
| Sales Order | ✅ | Draft → submit (HTTP reserve + credit-check, circuit breaker) → confirmed → delivery → return |
| Delivery Order | ✅ | 6-state lifecycle (draft→picking→packed→shipped→delivered\|failed), partial delivery |
| Sales Return | ✅ | draft → approved → goods_received → completed\|rejected |
| Purchasing | ✅ | PO lifecycle + Supplier CRUD + goods receipt → inventory event |
| Event-driven | ✅ | Outbox pattern + Pub/Sub + idempotent consumer + DLQ |
| API Gateway | ✅ | JWT verification, proxy routing, rate limiting, CORS |
| Frontend | ✅ | Next.js 15, Ant Design 5, full CRUD pages + dashboard + delivery/return tabs |
| E2E Tests | ✅ | 9 suites, ~80+ test cases covering all 9 business flows |

### Patterns đã implement

DDD layers · Repository pattern · Outbox pattern · CQRS-lite (`lifecycle_view` trong sales) · Aggregate Root · Synchronous submit flow (HTTP) · Circuit Breaker (opossum) · Optimistic Locking · Cache-Aside (Redis + Zod) · Event Envelope (versioned) · Idempotent Consumer · API Versioning `/v1/` · Error Boundary (React).

---

## 2. New ERP Design — CDC + Reporting Layer (chưa implement)

> Nguồn: [`new-erp-design/architecture-diagrams/01-high-level-component.md`](../../../new-erp-design/architecture-diagrams/01-high-level-component.md), [`07-kpi-layer-architecture.md`](../../../new-erp-design/architecture-diagrams/07-kpi-layer-architecture.md), [`08-unified-order-lifecycle-view.md`](../../../new-erp-design/architecture-diagrams/08-unified-order-lifecycle-view.md)

Kiến trúc target gồm pipeline 4 tầng:

```
Cloud SQL (OLTP) → Datastream CDC (~15 min) → BigQuery (OLAP) → dbt → Semantic Layer → Dashboards
```

### 2.1 Datastream CDC

- **Công nghệ:** GCP Datastream — managed CDC, near-real-time (~15 min lag)
- **Vai trò:** Replicate mọi thay đổi từ Cloud SQL (schema-per-context) sang BigQuery raw layer
- **Effort:** Config qua Terraform/console, không cần app code

### 2.2 BigQuery (Lakehouse pattern)

| Layer | Vai trò |
|---|---|
| Raw | Source snapshots từ CDC |
| Staging | Clean, normalize, time-partition |
| Marts | Domain fact + dimension tables (`fct_orders`, `dim_customer`, ...) |
| Metrics | KPI snapshot tables |

### 2.3 dbt Models (~25+ models ban đầu)

- **staging/** — 13 models: `stg_orders`, `stg_order_lines`, `stg_fulfillments`, `stg_customers`, `stg_inventory_movements`, `stg_purchase_orders`, `stg_goods_receipts`, `stg_3way_matches`, `stg_shipments`, `stg_ar_receipts`, `stg_ap_disbursements`, `stg_bank_transactions`, `stg_fast_events`
- **marts/** — 10 fact/dim: `fct_orders`, `fct_order_lines`, `fct_fulfillments`, `fct_bank_transactions`, `fct_3way_matches`, `dim_customer`, `dim_supplier`, `dim_warehouse`, `dim_logistic_provider`, `dim_date/dim_time`
- **metrics/** — 11 KPIs: `revenue_by_province`, `logistic_cost_by_province_by_provider` (Khang signature), `customer_segment_mix`, `channel_performance`, `supplier_concentration`, `inventory_days_on_hand`, `transfer_cost_quy_nhon`, `ar_aging`, `ap_aging`, `fulfillment_sla`, `3way_match_rate`

### 2.4 Semantic Layer + Distribution

- **Tool:** Lightdash / Cube / Looker (chưa chọn cuối cùng)
- **Output:** Web dashboard (BOD/Mgmt/Analysts), Mobile dashboard (BOD Friday meeting), Weekly KPI deck (auto-email PDF)
- **AI augmentation (D-043):** Anomaly detection (BigQuery ML), Narrative summary (Gemini), Forecasting

### 2.5 Unified Order-Lifecycle View (OLV)

- **Pattern:** CQRS read model — subscribe Pub/Sub events từ 7 bounded contexts → denormalized projection
- **Storage:** Cloud SQL (`order_lifecycle.lifecycle_records`, `events_log`, `sla_definitions`) + Memorystore hot cache + BigQuery materialized view (historical)
- **API:** GraphQL/REST + WebSocket subscription (live status updates) + PDF export
- **Performance targets:** view load p95 < 500ms, event lag p95 < 3s, 50 concurrent viewers
- **Frontends:** Manager Dashboard, Sales Rep Portal, Warehouse View, Customer Self-Service

> **So với prototype:** Prototype đã có `lifecycle_view` trong sales-service (CQRS-lite), nhưng chỉ nội bộ 1 service. Target mở rộng thành cross-context aggregation từ 7+ bounded contexts, thêm GraphQL + WebSocket + SLA tracking.

---

## 3. Gap Summary

| Component | Prototype | New Design | Gap |
|---|:---:|:---:|---|
| OLTP Services (6 BCs) | ✅ | ✅ | Prototype có 6 BC đơn giản; new design thêm WMS, Logistics, AR/AP, Cash Recon, FAST Adapter |
| Outbox + Pub/Sub events | ✅ | ✅ | Pattern đã có, new design mở rộng thêm event types |
| **Datastream CDC** | ❌ | ✅ | Chưa có — cần GCP Datastream config (Terraform) |
| **BigQuery OLAP** | ❌ | ✅ | Chưa có — cần dataset + 4 layers (raw/staging/marts/metrics) |
| **dbt models** | ❌ | ✅ | Chưa có — ~25+ models cần viết + test |
| **Semantic Layer** | ❌ | ✅ | Chưa có — Lightdash/Cube setup + KPI definitions |
| **Dashboard distribution** | ❌ | ✅ | Chưa có — Web + Mobile + email PDF |
| **Unified OLV (cross-context)** | ❌ (chỉ sales CQRS-lite) | ✅ | Chưa có — subscriber + projector + GraphQL + WebSocket |
| **AI augmentation** | ❌ | ✅ | Chưa có — Anomaly + Narrative + Forecast |

---

## 4. Kết luận

**Prototype hoàn thành 100% OLTP core** — đủ để demo và học microservice patterns (DDD, CQRS, Outbox, Saga, Circuit Breaker).

**Toàn bộ analytics pipeline (CDC → Reporting) chưa bắt đầu**, gồm:

1. **Infra:** Datastream CDC + BigQuery datasets — config/Terraform, không cần app code
2. **Data transform:** dbt project (~25 models + tests) — cần viết SQL + YAML
3. **Visualization:** Semantic layer setup + dashboard design — cần chọn tool + define KPIs
4. **Cross-context OLV:** Subscriber + projector service + GraphQL API — cần code service mới
5. **AI layer:** BigQuery ML + Gemini integration — cần model training + prompt engineering

> Theo [skill-assessment-roadmap](../learning/skill-assessment-roadmap.md) **Track C — Data/Analytics** (C1–C5), phần CDC/BigQuery/dbt được xếp vào learning roadmap riêng, không thuộc scope prototype ban đầu.

## Related Concepts

- [Implementation Status](../operations/implementation-status.md) — source of truth trạng thái prototype
- [System Flows](../operations/flows.md) — 9 luồng nghiệp vụ chính
- [System Overview](../architecture/system-overview.md) — kiến trúc tổng quan prototype
- [Skill Assessment Roadmap](../learning/skill-assessment-roadmap.md) — Track C Data/Analytics
