---
type: Concept Explanation
title: "Cloud SQL Core Concepts"
description: "Building blocks: Instance, Tier, Edition, Availability (HA), Storage & autoresize, Backup & PITR, Read replica, Connection & pooling"
tags: [cloud-sql, postgres, instance, tier, backup, replica, connection-pooling]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud SQL Core Concepts

## Định nghĩa

Cloud SQL xây trên vài khái niệm cốt lõi. Nắm chúng = biết cách chọn cỡ, đảm bảo an toàn dữ liệu, và tránh cạn connection.

## Tại sao quan trọng

Chọn sai tier → chậm hoặc đắt. Bỏ backup/HA → mất dữ liệu. Không hiểu connection limit → `too many connections` khi scale.

## Cách hoạt động

### 1. Instance — "máy chủ" Postgres managed

Một **instance** = một Postgres server managed, chứa nhiều **database**. Có version, tier, disk, cấu hình mạng, backup. Trong dự án: 1 instance `erp-postgres-dev`, 1 database `erp_prototype`.

### 2. Tier — cỡ máy (CPU/RAM)

| Tier | Loại | Dùng khi |
|---|---|---|
| `db-f1-micro` / `db-g1-small` | Shared-core (rẻ nhất) | Dev / prototype (dự án dùng `db-f1-micro`) |
| `db-custom-<cpu>-<ram>` | Dedicated | Prod — chọn CPU/RAM theo tải |

> [!TIP]
> Shared-core (`f1-micro`) tiết kiệm nhưng CPU chia sẻ + **giới hạn connection thấp** → phải dùng pooling. Prod nên dedicated (`db-custom-*`).

### 3. Edition & Availability (HA)

| Availability | Nghĩa | Chi phí |
|---|---|---|
| **ZONAL** | 1 zone. Zone chết → downtime tới khi khôi phục | Rẻ (dự án dùng cho dev) |
| **REGIONAL** | Standby đồng bộ ở zone khác → tự failover | ~Gấp đôi (prod) |

```
ZONAL:                          REGIONAL (HA):
┌── zone-a ──┐                  ┌── zone-a ──┐   sync   ┌── zone-b ──┐
│ Primary DB │                  │ Primary DB │◄───────►│ Standby DB │
└────────────┘                  └────────────┘         └────────────┘
 zone chết = down                zone-a chết → standby lên primary
```

### 4. Storage & autoresize

- **Disk size**: dung lượng cấp cho instance (dự án: 10GB).
- **Disk type**: `PD_SSD` (nhanh) vs `PD_HDD` (rẻ, chậm).
- **Autoresize**: bật → disk tự phình khi gần đầy (tránh downtime nhưng chi phí có thể tăng bất ngờ); tắt → bạn tự kiểm soát (dự án tắt: `disk_autoresize=false`).

> [!WARNING]
> Disk **đầy** → Postgres **dừng ghi** (read-only). Nếu tắt autoresize, phải theo dõi dung lượng và alert.

### 5. Backup & Point-in-Time Recovery (PITR)

- **Automated backup**: bản sao hằng ngày theo `start_time` (dự án: 03:00). Cho phép khôi phục về ngày cụ thể.
- **PITR** (qua WAL/binary log): khôi phục về **một thời điểm bất kỳ** trong cửa sổ retention → hạn chế mất dữ liệu khi xoá nhầm.

> [!IMPORTANT]
> Backup **bật sẵn** không đủ — phải **thử khôi phục** định kỳ. "Backup chưa test = chưa có backup."

### 6. Read Replica — scale đọc

Bản sao **chỉ đọc**, nhân bản bất đồng bộ từ primary. Đẩy tải đọc (report, analytics) khỏi primary.

```
Primary (đọc+ghi) ──async──▶ Read Replica (chỉ đọc)
   ▲ app ghi                     ▲ app đọc report
```

Đánh đổi: replica **trễ** (replication lag) → không đọc-sau-ghi ngay được. Dự án hiện **chưa** dùng replica (YAGNI — thêm khi tải đọc thành nút thắt).

### 7. Connection & Pooling — bẫy phổ biến nhất

Mỗi kết nối Postgres tốn RAM; tier nhỏ giới hạn số connection (dự án đặt `max_connections=50`).

```
Nhiều Cloud Run instance × pool riêng mỗi instance
   → tổng connection có thể VƯỢT 50 → "too many connections"
```

Giải: **connection pooling** (PgBouncer, Prisma pool, hoặc pooled URL). Dự án tách 2 URL:
- `connection_url` (pooled) — cho app runtime.
- `direct_url` — cho Prisma **migrate** (cần kết nối thẳng, không qua pool).

## Ví dụ thực tế

```
erp-postgres-dev: POSTGRES_16, db-f1-micro, ZONAL, PD_SSD 10GB (không autoresize)
  ├── database: erp_prototype
  ├── user: erp_app
  ├── backup 03:00 hằng ngày
  └── max_connections = 50  → app dùng pooled connection_url
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `too many connections` | Tổng pool > `max_connections` | Pooling; giảm pool/instance; tăng tier |
| Mất dữ liệu khi xoá nhầm | Không PITR / backup cũ | Bật PITR; test restore |
| DB dừng ghi đột ngột | Disk đầy (autoresize off) | Alert dung lượng; nới disk |
| Zone chết → app down | ZONAL, không HA | Prod dùng REGIONAL |
| Query chậm dần | Thiếu index / N+1 | Managed không cứu — tối ưu query/index |

## Related Concepts

- [Overview](./overview.md) — managed vs self-managed
- [Cloud SQL on GCP](./on-gcp.md) — private IP, Auth Proxy, ssl_mode
- [Cloud SQL in This Project](./in-this-project.md) — cấu hình thật + 2 URL
