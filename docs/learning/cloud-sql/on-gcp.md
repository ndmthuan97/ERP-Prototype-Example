---
type: Concept Explanation
title: "Cloud SQL on GCP"
description: "Đặc thù GCP: Private IP vs Public IP, Cloud SQL Auth Proxy, IAM database auth, ssl_mode, maintenance window, mô hình giá"
tags: [cloud-sql, gcp, private-ip, auth-proxy, ssl-mode, pricing]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud SQL on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách kết nối **an toàn** tới Cloud SQL và cách tính tiền.

## Cách hoạt động

### 1. Kết nối: 3 con đường

| Cách | Cơ chế | Dùng khi |
|---|---|---|
| **Private IP** | Instance có IP nội bộ trong VPC (qua Private Service Access) | App runtime (Cloud Run) — dự án dùng |
| **Public IP + Auth Proxy** | Proxy mã hoá + IAM-gated qua public IP | Dev máy local |
| Public IP + authorized_networks | Whitelist IP kết nối thẳng | **Tránh** — kém an toàn |

```
Runtime:   Cloud Run ─(private IP 10.x)─ VPC Connector ─ Peering ─▶ Cloud SQL
Dev local: máy dev ─ Cloud SQL Auth Proxy (TLS + IAM) ─(public IP)─▶ Cloud SQL
```

### 2. Private IP — vì sao ưu tiên

Instance nhận IP **nội bộ** trong VPC qua **Private Service Access** (VPC Peering với VPC của Google). App trong VPC gọi được; internet **không**. Không traffic DB nào đi qua internet.

> Chi tiết cơ chế peering + reserved IP range: [VPC in This Project](../vpc/vpc-in-this-project.md).

### 3. Cloud SQL Auth Proxy — kết nối local an toàn

Một binary chạy trên máy dev, mở kết nối tới instance mà:
- **Mã hoá** tự động (TLS), không cần tự quản cert.
- **IAM-gated**: chỉ danh tính có `roles/cloudsql.client` mới nối được.
- **Không cần** mở `authorized_networks` hay lộ IP.

> [!IMPORTANT]
> Nhờ Auth Proxy, dự án có thể bật public IP (`enable_public_ip=true`) mà **vẫn an toàn**: `authorized_networks` để rỗng → không ai nối thẳng bằng IP; chỉ Auth Proxy (đã xác thực IAM) vào được.

### 4. IAM database authentication

Thay vì mật khẩu Postgres, có thể đăng nhập bằng **danh tính IAM** (user/SA). Bớt quản lý mật khẩu. Dự án hiện dùng user Postgres truyền thống (`erp_app` + password trong Secret Manager) — IAM auth là đường nâng cấp.

### 5. ssl_mode — bẫy TLS quan trọng

| `ssl_mode` | Nghĩa |
|---|---|
| `ALLOW_UNENCRYPTED_AND_ENCRYPTED` (mặc định) | Chấp nhận cả kết nối không TLS |
| `ENCRYPTED_ONLY` | Bắt buộc TLS |
| `TRUSTED_CLIENT_CERTIFICATE_REQUIRED` | TLS + client cert |

> [!WARNING]
> Ép `ENCRYPTED_ONLY` **ngay** sẽ **reject mọi service đang chạy** nếu connection string của chúng không có `sslmode=require`. Thứ tự đúng: (1) thêm `sslmode=require` vào connection URL, (2) redeploy tất cả service, (3) *mới* flip `ssl_mode`. Đảo thứ tự → revision đang chạy chết.

### 6. Maintenance window

Google patch/nâng cấp trong **cửa sổ bảo trì** bạn chọn (giờ thấp điểm) → có thể restart ngắn. Đặt window vào lúc ít tải để giảm ảnh hưởng.

### 7. Mô hình giá

```
Chi phí ≈ (tier: vCPU+RAM chạy 24/7) + (storage GB) + (backup storage) + (network egress) [+ HA ×~2]
```

| Yếu tố | Ghi chú |
|---|---|
| Instance (tier) | Tính **24/7** — Cloud SQL **không** scale-to-zero như Cloud Run |
| Storage | Theo GB cấp; autoresize có thể tăng chi phí |
| HA (REGIONAL) | ~gấp đôi instance |
| Backup | Backup storage tính riêng |

> [!IMPORTANT]
> **Cloud SQL luôn chạy → luôn tốn tiền** (khác Cloud Run). Đây thường là khoản tốn ổn định nhất của hệ. Dev dùng `db-f1-micro` ZONAL để tối thiểu (~$8-10/mo).

## Ví dụ thực tế

```
Dev:  db-f1-micro, ZONAL, public IP ON (chỉ cho Auth Proxy), ssl_mode mặc định
Prod: db-custom-*, REGIONAL, private-only (public IP OFF), ssl_mode=ENCRYPTED_ONLY (sau khi redeploy)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Service reject sau khi bật TLS | Ép `ENCRYPTED_ONLY` trước khi thêm `sslmode=require` | Theo đúng 3 bước ở §5 |
| Local nối DB fail | Chưa chạy Auth Proxy / thiếu `cloudsql.client` | Chạy proxy; cấp role cho danh tính dev |
| Runtime nối private IP timeout | Thiếu VPC connector (phía Cloud Run) | Gắn connector — xem [Cloud Run on GCP](../cloud-run/on-gcp.md) |
| Tưởng bật public IP là mở toang | Hiểu sai | `authorized_networks` rỗng = vẫn khoá |

## Related Concepts

- [Core Concepts](./core-concepts.md) — HA, backup, connection
- [Cloud SQL in This Project](./in-this-project.md) — IP config & 2 URL
- [VPC in This Project](../vpc/vpc-in-this-project.md) — Private Service Access
