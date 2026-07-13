---
type: Reference
title: "Cloud SQL in This Project"
description: "Mapping Cloud SQL → module database trong ERP Prototype: instance, IP config, backup, max_connections, connection URL và bẫy ssl_mode"
tags: [cloud-sql, postgres, terraform, erp, gcp, prisma]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/database/main.tf"
---

# Cloud SQL in This Project

> Mapping từ lý thuyết Cloud SQL sang Terraform thật. Mỗi resource trong module `database` giải thích từng phần.

> Liên quan: [VPC in This Project](../vpc/vpc-in-this-project.md) · [Secret Manager](../secret-manager/in-this-project.md) · [data-model.md](../../architecture/data-model.md)

---

## 1. Instance

Source: [`infra/modules/database/main.tf`](../../infra/modules/database/main.tf)

```hcl
resource "google_sql_database_instance" "main" {
  name                = "erp-postgres-${var.environment}"
  database_version    = "POSTGRES_16"
  deletion_protection = false

  settings {
    tier              = var.db_tier          # db-f1-micro (mặc định)
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10                     # GB
    disk_autoresize   = false                  # kiểm soát chi phí
    disk_type         = "PD_SSD"
    ...
  }
}
```

| Field | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| `database_version` | `POSTGRES_16` | Postgres 16 |
| `tier` | `db-f1-micro` | Shared-core, ~$8-10/mo, đủ dev |
| `availability_type` | `ZONAL` | 1 zone. Prod nên `REGIONAL` |
| `disk_size`/`disk_autoresize` | `10GB`/`false` | Cố định, tránh phình chi phí bất ngờ |
| `deletion_protection` | `false` | Dev cho destroy. **Prod PHẢI `true`** |

## 2. IP Configuration (điểm tinh tế nhất)

```hcl
ip_configuration {
  ipv4_enabled    = var.enable_public_ip   # dev: true, chỉ cho Auth Proxy
  private_network = var.vpc_network         # peering vào VPC → private IP
  # authorized_networks: KHÔNG set → không truy cập IP trực tiếp
}
```

| Field | Giá trị | Ghi chú |
|---|---|---|
| `private_network` | VPC id | Private IP qua Private Service Access ([VPC doc](../vpc/vpc-in-this-project.md)) |
| `ipv4_enabled` | `true` (dev) | Public IP để chạy **Cloud SQL Auth Proxy** local |
| `authorized_networks` | *(không set)* | **Cố ý** — không IP nào nối thẳng; chỉ Auth Proxy (IAM) |

> [!IMPORTANT]
> `enable_public_ip=true` **không** phải "mở DB ra internet". `authorized_networks` rỗng → không ai nối trực tiếp. Muốn private-only: đặt `false`. Xem [on-gcp §3](./on-gcp.md).

> [!WARNING]
> `ssl_mode` cố ý để mặc định. Ép `ENCRYPTED_ONLY` ngay sẽ reject service đang chạy (connection string không có `sslmode=require`). Theo 3 bước ở [on-gcp §5](./on-gcp.md) trước khi flip.

## 3. Backup & Database Flag

```hcl
backup_configuration { enabled = true, start_time = "03:00" }
database_flags { name = "max_connections", value = "50" }
```

> [!NOTE]
> `db-f1-micro` giới hạn connection thấp → đặt `max_connections=50`. **Đây là lý do phải pooling** (xem §5). Backup hằng ngày lúc 3h sáng.

## 4. Database + User

```hcl
resource "google_sql_database" "erp"  { name = "erp_prototype" ... }
resource "google_sql_user"     "app"  { name = "erp_app", password = var.db_password ... }
```

Một database, một user app. `db_password` là `sensitive` variable (không lộ trong plan/log).

## 5. Outputs — 2 connection URL chảy vào Secret Manager

```hcl
output "connection_url" {          # pooled — cho app runtime
  value     = "postgresql://erp_app:${var.db_password}@${private_ip}:5432/erp_prototype?schema=public"
  sensitive = true
}
output "direct_url" { ... }        # cho Prisma migrate (kết nối thẳng)
```

> [!IMPORTANT]
> Mắt xích chính: `module.database.connection_url` → `module.secrets` tạo secret `database-url-dev` → Cloud Run inject qua `secret_key_ref`. **Password không bao giờ nằm trong image/env plain.** Xem [Secret Manager in This Project](../secret-manager/in-this-project.md).
>
> Hai URL, hai mục đích: app dùng **pooled** `connection_url`; Prisma migrate dùng **direct** `direct_url` (migrate cần kết nối thẳng, không qua pool).

## 6. Luồng kết nối tổng thể

```
Runtime:   backend-svc → private IP 10.x:5432 → VPC Connector → Peering → Cloud SQL
Dev local: máy dev → Cloud SQL Auth Proxy (IAM, TLS) → public IP → Cloud SQL
```

Cả hai không đi qua internet dạng plaintext. Luồng Auth Proxy: `docs/operations/run-backend-with-prod-config.md`.

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [VPC in This Project](../vpc/vpc-in-this-project.md) · [Secret Manager](../secret-manager/index.md) · [Cloud Run](../cloud-run/index.md)
