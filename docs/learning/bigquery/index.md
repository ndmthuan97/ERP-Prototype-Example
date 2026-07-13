# BigQuery — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **BigQuery** — data warehouse serverless (OLAP) của Google Cloud. Theo Pareto: 20% quan trọng nhất để hiểu warehouse/analytics và không "cháy" hoá đơn query.

> [!NOTE]
> BigQuery **chưa được triển khai** trong ERP hiện tại — đây là **lớp analytics/reporting dự kiến** (roadmap). Xem [in-this-project](./in-this-project.md) và kế hoạch [`cdc-reporting-learning-plan.md`](../../operations/cdc-reporting-learning-plan.md).

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | BigQuery là gì, OLAP vs OLTP, data warehouse, columnar serverless, vs Cloud SQL |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Dataset/Table, columnar storage, Partitioning, Clustering, Slots, Standard SQL, load/stream |
| [BigQuery on GCP](./on-gcp.md) | Concept Explanation | Serverless architecture, mô hình giá (on-demand vs slots), federated query, BigQuery ML, Datastream/Looker |
| [BigQuery in This Project](./in-this-project.md) | Reference | **Chưa dùng** — roadmap CDC reporting: Cloud SQL → Datastream → BigQuery → dbt → Looker Studio |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Full scan đốt tiền, nhầm OLTP, thiếu partition, cost runaway |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → OLAP vs OLTP, warehouse là gì
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → dataset/partition/slot/columnar
3. **GCP cụ thể**: [BigQuery on GCP](./on-gcp.md) → giá, serverless, tích hợp
4. **Áp dụng (roadmap)**: [BigQuery in This Project](./in-this-project.md) → kế hoạch CDC reporting
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Cloud SQL](../cloud-sql/index.md) — nguồn OLTP; BigQuery là lớp OLAP tách biệt (qua CDC)
- [cdc-reporting-learning-plan.md](../../operations/cdc-reporting-learning-plan.md) — kế hoạch triển khai thin-slice
