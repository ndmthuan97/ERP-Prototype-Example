---
type: Reference
title: "Cloud Run — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp khi chạy Cloud Run + trong dự án ERP: container không start, 503, cold start, IAM invoker, secret access, drift Cloud Deploy"
tags: [cloud-run, troubleshooting, pitfalls, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/cloud-run/main.tf"
---

# Cloud Run — Troubleshooting & Pitfalls

> Tra cứu nhanh khi service không lên, request lỗi, hoặc deploy hành xử lạ.

## 1. Deploy / khởi động

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `Container failed to start. Failed to listen on PORT` | App không bind `$PORT` hoặc nghe `localhost` | Bind `process.env.PORT` (mặc định 8080), host `0.0.0.0` |
| Deploy treo rồi fail sau vài phút | `startup_probe` không bao giờ pass (sai path/port) | Kiểm `startup_probe_path` khớp endpoint health thật |
| App boot quá lâu → probe fail | Boot nặng (migration lúc start, tải model) | Tách việc nặng khỏi startup; bật startup CPU boost; nới `failure_threshold` |

## 2. Runtime / request

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Request đầu chậm (vài giây) | Cold start (min=0) | `min>0` cho service nóng; giảm image size |
| `503 Service Unavailable` khi tải cao | Chạm `max_instance_count` | Tăng max; hoặc tăng concurrency nếu I/O-bound |
| Request bị cắt ở ~300s | Chạm `timeout` | Tách tác vụ dài ra Pub/Sub / Cloud Run Jobs |
| Bug ngẫu nhiên khi tải cao | Concurrency cao + code không thread-safe | Giảm concurrency hoặc sửa async-safe |
| Mất session/state sau ít phút | Lưu state trong RAM, instance bị scale-to-zero | Đẩy state ra Redis/DB (stateless) |

## 3. Kết nối tài nguyên private (Cloud SQL)

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Connect Cloud SQL private IP timeout | Thiếu VPC connector / thiếu `vpc_access` | Gắn `vpc_connector` (chỉ backend `needs_vpc`) |
| Chạm được DB nhưng gọi API ngoài chậm | `egress=ALL_TRAFFIC` ép hết qua connector | Đổi `PRIVATE_RANGES_ONLY` |
| `too many connections` | Nhiều instance × pool > `max_connections=50` | Dùng pooled `connection_url`; xem [Cloud SQL](../cloud-sql/troubleshooting-and-pitfalls.md) |

## 4. IAM / quyền

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Gọi service trả `403 Forbidden` | Caller thiếu `roles/run.invoker` | Cấp invoker cho đúng SA (hoặc `allUsers` nếu public) |
| Service crash lúc start: không đọc được secret | Runtime SA thiếu `secretmanager.secretAccessor` | Bind per-secret cho runtime SA — xem [Secret Manager](../secret-manager/in-this-project.md) |
| Backend gọi được từ internet | `ingress=all` (nên `internal-only`) | Đặt backend `internal-only` |

## 5. Bẫy Terraform / Cloud Deploy (đặc thù dự án)

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Sửa spec service trong Terraform | Không ăn — spec ở `deploy/manifests/*.yaml` | Sửa manifest, không sửa module cloud-run |
| Quên `state rm` khi bàn giao Cloud Deploy | `apply` báo "8 to destroy" | Chạy 2 lệnh `state rm` (xem [in-this-project §0](./in-this-project.md)) |
| Bỏ `ignore_changes` trên image | Mỗi `apply` rollback image cũ, phá deploy | Giữ `lifecycle.ignore_changes` |
| `deletion_protection=false` lên prod | 1 `destroy` xoá service | Prod đặt `true` |

## Related Concepts

- [Cloud Run in This Project](./in-this-project.md) — cấu hình module + drift Cloud Deploy
- [Core Concepts](./core-concepts.md) — cold start, concurrency, container contract
- [Cloud Run on GCP](./on-gcp.md) — VPC egress, min-instances
