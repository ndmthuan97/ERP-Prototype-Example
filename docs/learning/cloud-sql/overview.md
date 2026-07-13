---
type: Learning Note
title: "Cloud SQL Overview"
description: "Managed database là gì, tại sao Cloud SQL, self-managed vs managed, so sánh với AlloyDB / Cloud Spanner / self-host và cross-cloud"
tags: [learning, cloud-sql, postgres, managed-database, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud SQL Overview

## Summary

**Cloud SQL** = PostgreSQL (hoặc MySQL/SQL Server) **do Google quản lý**. Bạn khai "muốn Postgres 16, cỡ máy X, disk Y" → Google lo cài đặt, patch, backup, replication, failover. Bạn chỉ việc kết nối và dùng.

```
   Tự host Postgres (VM)              Cloud SQL (managed)
  ┌────────────────────┐            ┌────────────────────┐
  │ Bạn lo:            │            │ Google lo:         │
  │ • Cài đặt OS/PG    │            │ • OS/PG install    │
  │ • Patch bảo mật    │    ──▶     │ • Patch tự động    │
  │ • Backup + test    │            │ • Backup + PITR    │
  │ • Replication/HA   │            │ • HA/failover      │
  │ • Monitoring       │            │ • Metrics sẵn      │
  └────────────────────┘            └────────────────────┘
     Bạn còn lo: schema, query, index, connection pooling
```

## Key Concepts

### Managed vs Self-managed — đánh đổi gì?

| | Tự host (VM) | Cloud SQL (managed) |
|---|---|---|
| Vận hành | Bạn lo tất cả | Google lo hạ tầng |
| Chi phí | VM rẻ hơn theo giờ | Trả thêm cho "managed" |
| Kiểm soát | Toàn quyền (extension lạ, tuning sâu) | Giới hạn ở tham số cho phép |
| Rủi ro con người | Cao (quên backup, patch trễ) | Thấp |
| Hợp cho | Team có DBA, nhu cầu đặc biệt | **Đa số app** — muốn dồn sức vào sản phẩm |

> [!IMPORTANT]
> Managed **không** lo giúp bạn: **schema design, query/index, connection pooling, N+1**. DB managed vẫn sập vì query tệ hoặc cạn connection. Phần "logic dữ liệu" vẫn là việc của bạn.

### Cloud SQL so với các DB khác trên GCP

| Lựa chọn | Khi nào |
|---|---|
| **Cloud SQL** | Postgres/MySQL truyền thống, quy mô vừa — **mặc định hợp lý** |
| AlloyDB | Postgres-compatible, hiệu năng cao / analytics nặng |
| Cloud Spanner | Quy mô global, horizontal scale, strong consistency (đắt, phức tạp) |
| Firestore | NoSQL document, realtime, mobile |
| BigQuery | Analytics/warehouse (OLAP), không phải OLTP |

Dự án là ERP OLTP quy mô vừa → **Cloud SQL Postgres** là lựa chọn đúng nấc thang (không premature scale sang Spanner).

### Cross-cloud

| | GCP | AWS | Azure |
|---|---|---|---|
| Managed relational | **Cloud SQL** | RDS | Azure Database for PostgreSQL |
| Kết nối riêng tư | Private Service Access | RDS trong VPC | Private Endpoint |
| Proxy an toàn | Cloud SQL Auth Proxy | RDS Proxy / IAM auth | — |

### Vị trí trong kiến trúc ERP

```
Cloud Run backend ──(private IP qua VPC)──▶ Cloud SQL (Postgres 16)
                                              │
                          connection_url/direct_url → Secret Manager → inject vào backend
```

Cloud SQL là **nguồn sự thật (source of truth)** — mọi state bền của ERP (customer, order, inventory...) nằm ở đây. Prisma là ORM truy cập.

## Practical Application

Dùng Cloud SQL khi:
- Cần relational DB (Postgres/MySQL) chuẩn, transaction ACID.
- Muốn managed backup/patch/HA, không có/không muốn DBA riêng.
- Quy mô OLTP vừa (chưa cần global multi-region write).

Cân nhắc khác khi:
- Cần scale ghi global cực lớn → Spanner.
- Workload analytics → BigQuery.

## References

- [Cloud SQL Docs](https://cloud.google.com/sql/docs) — tài liệu chính thức
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres) — bản Postgres
- [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) — kết nối an toàn

## Related Concepts

- [Core Concepts](./core-concepts.md) — instance, tier, backup, replica
- [Cloud SQL on GCP](./on-gcp.md) — private IP, Auth Proxy, ssl_mode
- [Cloud SQL in This Project](./in-this-project.md) — module database
