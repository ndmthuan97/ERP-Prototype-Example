---
type: Reference
title: "VPC Troubleshooting & Pitfalls"
description: "Các lỗi hay gặp khi làm VPC trên GCP + Cloud Run: ingress 404, connector timeout, CIDR overlap, cold start"
tags: [vpc, troubleshooting, gcp, cloud-run, debugging, pitfalls]
diataxis: how-to
timestamp: "2026-07-02T15:10:00+07:00"
---

# VPC Troubleshooting & Pitfalls

> Tổng hợp các lỗi thường gặp khi cấu hình VPC trên GCP, đặc biệt khi kết hợp với Cloud Run. Rút ra từ kinh nghiệm thực tế khi triển khai dự án ERP.

---

## 1. Cloud Run → Cloud SQL: Connection Timeout

**Triệu chứng:** Cloud Run service báo `ETIMEOUT` hoặc `ECONNREFUSED` khi kết nối Cloud SQL.

**Nguyên nhân phổ biến:**

| # | Nguyên nhân | Cách kiểm tra |
|---|---|---|
| 1 | Chưa gắn VPC Connector | Kiểm tra Cloud Run service → Networking tab |
| 2 | Cloud SQL chưa bật Private IP | Kiểm tra Cloud SQL → Connections → Private IP |
| 3 | Private Service Access chưa tạo | Kiểm tra VPC → Private Service Access |
| 4 | CIDR overlap | So sánh dải IP của Subnet, VPC Connector, và Reserved Range |
| 5 | Sai connection string | URL phải dùng **private IP** của Cloud SQL, không phải public |

**Checklist debug:**

```bash
# 1. Kiểm tra Cloud SQL có private IP chưa
gcloud sql instances describe erp-db-dev --format="get(ipAddresses)"

# 2. Kiểm tra VPC Connector đang chạy
gcloud compute networks vpc-access connectors describe erp-vpc-connector \
  --region=us-central1

# 3. Kiểm tra Private Service Access
gcloud services vpc-peerings list --network=erp-vpc-dev

# 4. Kiểm tra Cloud Run có gắn connector
gcloud run services describe auth-service-dev --region=us-central1 \
  --format="get(template.vpcAccess)"
```

---

## 2. Cloud Run Ingress 404 — Gateway → Backend

**Triệu chứng:** API Gateway gọi backend services (auth, customer...) bị trả về 404, dù URL đúng.

**Nguyên nhân:** Kết hợp của `ingress = internal` + VPC Connector `egress = PRIVATE_RANGES_ONLY`.

**Giải thích:**

```
Gateway (Cloud Run) → gọi auth-service-dev.run.app (public URL)
       │
       ├─ egress = PRIVATE_RANGES_ONLY
       │  → URL *.run.app là public IP → traffic ĐI RA INTERNET (không qua VPC)
       │
       └─ auth-service ingress = internal
          → Chỉ nhận traffic từ TRONG GCP project
          → Traffic từ internet bị chặn → 404
```

**Giải pháp (đã áp dụng trong dự án):**

Đổi backend services sang `ingress = all` nhưng **không** thêm `allUsers` invoker:

```hcl
# ingress = "all" nhưng is_public = false
# → URL accessible nhưng phải có IAM permission (roles/run.invoker)
"auth-service" = {
  ingress   = "all"     # Cho phép traffic từ mọi nơi
  is_public = false     # KHÔNG thêm allUsers → vẫn cần authentication
}
```

> [!IMPORTANT]
> **`ingress = all` + `is_public = false` ≠ ai cũng vào được.** IAM vẫn bảo vệ — chỉ Service Account có `roles/run.invoker` mới gọi được. Đây là posture bảo mật đúng: network mở, IAM khoá.

**Giải pháp thay thế (phức tạp hơn):**
- Gateway dùng `egress = ALL_TRAFFIC` + Cloud NAT → traffic đi qua VPC → xuất ra qua NAT → vào lại Cloud Run internal endpoint
- Tốn thêm ~$1/month cho Cloud NAT và phức tạp hơn về cấu hình

---

## 3. CIDR Overlap — Lỗi khi tạo VPC Connector

**Triệu chứng:** `terraform apply` báo lỗi khi tạo VPC Connector:

```
Error: Error creating Connector: googleapi: Error 400:
The given IP CIDR range overlaps with an existing subnetwork
```

**Nguyên nhân:** Dải IP của VPC Connector trùng với Subnet hoặc Reserved Range.

**Cách tránh:** Đảm bảo 3 dải IP không overlap:

```
VPC: 10.0.0.0/16 (tổng thể)
│
├── Subnet:         10.0.0.0/24   (256 IPs)
├── Reserved Range: 10.64.0.0/20  (4096 IPs, GCP tự chọn trong khoảng này)
└── VPC Connector:  10.8.0.0/28   (16 IPs)

→ Ba dải này KHÔNG trùng nhau → OK ✅
```

**Mẹo:** Luôn dùng các dải IP cách xa nhau: `10.0.x.x` cho subnet, `10.8.x.x` cho connector.

---

## 4. VPC Connector — Luôn tốn tiền

**Triệu chứng:** Hoá đơn GCP vẫn ~$7/month dù Cloud Run đã scale xuống 0 instances.

**Nguyên nhân:** VPC Connector dùng VM thật (`e2-micro`), chạy 24/7, **không scale-to-zero**.

```
Cloud Run:     min=0 → scale-to-zero ✅ (free khi idle)
VPC Connector: min=2 → LUÔN CHẠY ❌ (~$7/month)
```

**Cách giảm thiểu:**
- Dùng `machine_type = "e2-micro"` (nhỏ nhất)
- Đặt `min_instances = 2` (tối thiểu yêu cầu bởi GCP)
- Đặt `max_instances = 3` (giới hạn chi phí)

**Giải pháp tương lai:** GCP đang phát triển **Direct VPC Egress** cho Cloud Run — cho phép kết nối VPC mà không cần Connector. Khi GA (Generally Available), nó sẽ loại bỏ chi phí cố định này.

---

## 5. PowerShell Delimiter Bug — gcloud trên Windows

**Triệu chứng:** `terraform apply` chạy `gcloud run services update --update-env-vars` bị lỗi: tất cả URL bị gộp vào biến đầu tiên.

**Nguyên nhân:** PowerShell parse dấu `,` (comma) trong `--update-env-vars` như array operator, không phải delimiter.

```powershell
# PowerShell hiểu:
--update-env-vars="AUTH_URL=https://a.run.app,CUSTOMER_URL=https://b.run.app"
#                  ↑ tất cả gộp vào AUTH_URL    ↑ bị tách thành mảng PowerShell
```

**Giải pháp (đã áp dụng):** Dùng `gcloud` custom delimiter syntax `^@^`:

```powershell
# Thay ',' bằng '@' làm separator
--update-env-vars="^@^AUTH_URL=https://a.run.app@CUSTOMER_URL=https://b.run.app"
```

---

## 6. Startup Probe: Liveness vs Readiness

**Triệu chứng:** Cloud Run service deploy thành công nhưng liên tục restart, báo `startup probe failed`.

**Nguyên nhân:** Startup probe gọi `/health` (readiness check) thay vì `/health/live` (liveness check). Readiness check kiểm tra cả database connection — nếu Cloud SQL chưa sẵn sàng (cold start) → 503 → Cloud Run tưởng container lỗi → restart.

**Giải pháp:**

```hcl
# ĐÚNG: Startup probe chỉ kiểm tra "server có sống không?"
startup_probe_path = "/health/live"   # 200 nếu process đang chạy

# SAI: Startup probe kiểm tra cả dependencies
startup_probe_path = "/health"        # 503 nếu DB chưa connect
```

> [!TIP]
> **Quy tắc:** Startup/Liveness probe kiểm tra "process có sống không" (`/health/live`). Readiness probe kiểm tra "sẵn sàng nhận traffic chưa" (`/health`). Dự án ERP phân biệt rõ: backend dùng `/health/live`, gateway + frontend dùng `/health`.

---

## Quick Reference — Debug Commands

```bash
# VPC & Subnet
gcloud compute networks list
gcloud compute networks subnets list --network=erp-vpc-dev

# VPC Connector
gcloud compute networks vpc-access connectors list --region=us-central1

# Cloud SQL networking
gcloud sql instances describe erp-db-dev --format="get(ipAddresses)"

# Cloud Run networking
gcloud run services describe <service> --region=us-central1 \
  --format="yaml(template.vpcAccess)"

# Test connectivity from Cloud Run (via Cloud Shell)
gcloud run services logs read <service> --region=us-central1 --limit=50
```

## Related Concepts

- [VPC in This Project](./vpc-in-this-project.md) — cấu hình thực tế
- [VPC on GCP](./vpc-on-gcp.md) — lý thuyết VPC Connector, Private Service Access
- [Core Concepts](./core-concepts.md) — 6 building blocks
