---
type: Reference
title: "Cloud SQL — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: too many connections, TLS/ssl_mode reject, disk full, deletion protection, pooled vs direct URL"
tags: [cloud-sql, postgres, troubleshooting, pitfalls, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/database/main.tf"
---

# Cloud SQL — Troubleshooting & Pitfalls

> Tra cứu nhanh khi DB lỗi kết nối, mất dữ liệu, hoặc apply hành xử lạ.

## 1. Kết nối

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `too many connections` / `remaining connection slots` | Tổng pool các instance > `max_connections=50` | Dùng pooled `connection_url`; giảm pool/instance; tăng tier |
| Runtime nối private IP timeout | Thiếu VPC connector phía Cloud Run | Gắn connector ([Cloud Run on GCP](../cloud-run/on-gcp.md)) |
| Local nối DB fail | Chưa chạy Auth Proxy / thiếu `roles/cloudsql.client` | Chạy Auth Proxy; cấp role cho danh tính dev |
| Prisma migrate treo/timeout | Dùng pooled URL cho migrate | Migrate dùng `direct_url` (kết nối thẳng) |

## 2. TLS / ssl_mode

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Sau khi bật TLS, mọi service reject | Ép `ENCRYPTED_ONLY` trước khi URL có `sslmode=require` | (1) thêm `sslmode=require` vào output → (2) redeploy hết → (3) mới flip `ssl_mode` |
| Tưởng `enable_public_ip=true` mở internet | Hiểu sai | `authorized_networks` rỗng = vẫn khoá; chỉ Auth Proxy vào |

## 3. Lưu trữ & dữ liệu

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| DB đột ngột chỉ đọc, ghi fail | Disk đầy (`disk_autoresize=false`) | Alert dung lượng; nới `disk_size`; hoặc bật autoresize (đánh đổi chi phí) |
| Mất dữ liệu sau xoá nhầm | Không PITR / chỉ backup ngày | Bật PITR; **test restore** định kỳ |
| Zone chết → app mất DB | `ZONAL` không HA | Prod dùng `REGIONAL` |

## 4. Bẫy Terraform (đặc thù dự án)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| `deletion_protection=false` lên prod | 1 `terraform destroy` xoá sạch DB | Prod đặt `true` |
| Nhầm `direct_url` cho app runtime | Bỏ pooling → cạn connection nhanh | App dùng `connection_url`; `direct_url` chỉ migrate |
| Đổi `tier` khi đang tải cao | Instance restart → downtime ngắn | Đổi trong maintenance window |
| Commit `db_password` vào tfvars public | Lộ mật khẩu vĩnh viễn (git) | tfvars trong `.gitignore`; là `sensitive` var |

## 5. Checklist trước khi lên prod

- [ ] `deletion_protection = true`
- [ ] `availability_type = REGIONAL`
- [ ] Tier dedicated (`db-custom-*`) thay `db-f1-micro`
- [ ] PITR bật + đã test restore
- [ ] Public IP OFF (private-only) hoặc chỉ Auth Proxy
- [ ] Kế hoạch bật `ENCRYPTED_ONLY` theo đúng 3 bước

## Related Concepts

- [Cloud SQL in This Project](./in-this-project.md) — cấu hình module
- [Core Concepts](./core-concepts.md) — connection pooling, HA, backup
- [Cloud SQL on GCP](./on-gcp.md) — ssl_mode, Auth Proxy
