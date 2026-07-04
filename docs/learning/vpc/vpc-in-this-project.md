---
type: Reference
title: "VPC in This Project"
description: "Mapping lý thuyết VPC → Terraform code thực tế trong dự án ERP Prototype — từng resource giải thích chi tiết"
tags: [vpc, terraform, erp, gcp, networking, cloud-run, cloud-sql]
diataxis: reference
timestamp: "2026-07-02T15:10:00+07:00"
resource: "file://infra/modules/networking/main.tf"
---

# VPC in This Project

> Mapping từ lý thuyết VPC sang Terraform code thực tế trong dự án ERP Prototype. Mỗi resource trong module `networking` được giải thích từng dòng.

> Liên quan: [GCP Cloud Architecture](../../architecture/gcp-cloud-architecture.md) · [VPC on GCP](./vpc-on-gcp.md)

---

## 1. Architecture Diagram

```
┌── Cloud Run Services (ngoài VPC) ────────────────┐
│                                                    │
│  api-gateway-dev    auth-service-dev               │
│  customer-svc-dev   sales-service-dev              │
│  inventory-svc-dev  catalog-service-dev            │
│  purchasing-svc-dev frontend-dev (KHÔNG dùng VPC) │
│                                                    │
└────────────────┬───────────────────────────────────┘
                 │ egress: PRIVATE_RANGES_ONLY
                 ▼
┌── VPC Connector (10.8.0.0/28) ─────────────────────┐
│  erp-vpc-connector                                   │
│  e2-micro × 2-3 instances                            │
└────────────────┬────────────────────────────────────┘
                 │
┌── erp-vpc-dev (Custom VPC) ─────────────────────────┐
│                                                      │
│  ┌── Subnet: erp-subnet-dev ──┐                     │
│  │  10.0.0.0/24 (us-central1) │                     │
│  │  (hiện chưa có VM nào)     │                     │
│  └────────────────────────────┘                     │
│                                                      │
│  ┌── Reserved IP: erp-private-ip-dev ──┐            │
│  │  10.x.x.0/20 (4096 IPs)            │            │
│  │  Purpose: VPC_PEERING               │            │
│  └───────────────┬─────────────────────┘            │
│                  │ Private Service Access            │
└──────────────────┼──────────────────────────────────┘
                   │ (VPC Peering)
┌── Google's VPC ──┴──────────────────────────────────┐
│                                                      │
│  ┌── Cloud SQL (PostgreSQL 16) ──┐                  │
│  │  erp-db-dev (db-f1-micro)     │                  │
│  │  Private IP only              │                  │
│  └───────────────────────────────┘                  │
└──────────────────────────────────────────────────────┘
```

---

## 2. Terraform Code — Giải thích từng Resource

Source code: [`infra/modules/networking/main.tf`](../../infra/modules/networking/main.tf)

### Resource 1: VPC Network

```hcl
resource "google_compute_network" "vpc" {
  name                    = "erp-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false  # Custom mode — KHÔNG tự tạo subnet ở mọi region
}
```

| Thuộc tính | Giá trị | Giải thích |
|---|---|---|
| `name` | `erp-vpc-dev` | Tên VPC, kèm suffix môi trường |
| `auto_create_subnetworks` | `false` | Dùng Custom mode — ta tự tạo subnet ở region cần thiết thay vì để GCP tự tạo ở tất cả 40+ regions |

**Tại sao Custom mode?** Auto mode tạo subnet ở mọi region (lãng phí) và dùng dải CIDR cố định `10.128.0.0/20` — dễ conflict khi peering.

---

### Resource 2: Subnet

```hcl
resource "google_compute_subnetwork" "main" {
  name          = "erp-subnet-${var.environment}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"  # 256 IPs
}
```

| Thuộc tính | Giá trị | Giải thích |
|---|---|---|
| `region` | `us-central1` | Subnet chỉ thuộc 1 region (VPC là global, nhưng subnet là regional) |
| `ip_cidr_range` | `10.0.0.0/24` | 256 IP — đủ cho VMs nếu cần thêm sau này |
| `network` | `google_compute_network.vpc.id` | Thuộc VPC vừa tạo ở trên |

> [!NOTE]
> Subnet này hiện chưa có VM nào chạy bên trong. Nó được tạo sẵn cho trường hợp cần thêm Compute Engine hoặc GKE sau này. Cloud Run kết nối qua VPC Connector (resource riêng, dùng dải CIDR riêng `10.8.0.0/28`).

---

### Resource 3: Reserved IP Range cho Cloud SQL Peering

```hcl
resource "google_compute_global_address" "private_ip_range" {
  name          = "erp-private-ip-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20             # 4096 IPs
  network       = google_compute_network.vpc.id
}
```

| Thuộc tính | Giá trị | Giải thích |
|---|---|---|
| `purpose` | `VPC_PEERING` | Dải IP này dành riêng cho việc peering — Google sẽ cấp IP trong dải này cho Cloud SQL |
| `address_type` | `INTERNAL` | IP nội bộ, không expose ra internet |
| `prefix_length` | `20` | 4096 IPs — dư dả cho nhiều Cloud SQL instances |

**Tại sao cần?** Khi tạo VPC Peering với Google, bạn phải **đặt trước** (reserve) một dải IP trong VPC của bạn để Google dùng. Nếu dải này trùng với subnet đang có → lỗi overlap.

---

### Resource 4: Private Service Access

```hcl
resource "google_service_networking_connection" "private_service" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}
```

| Thuộc tính | Giá trị | Giải thích |
|---|---|---|
| `service` | `servicenetworking.googleapis.com` | Dịch vụ peering của Google — kết nối VPC của bạn với VPC nội bộ của Google (nơi chạy Cloud SQL) |
| `reserved_peering_ranges` | Dải IP đã reserve ở trên | Dải IP mà Google được phép sử dụng |

**Đây chính là bước "bắt tay":** VPC của bạn nói với Google: *"Tôi cho phép bạn dùng dải 10.x.x.0/20 để gán private IP cho Cloud SQL, và tôi sẽ route traffic đến dải đó qua peering."*

---

### Resource 5: VPC Connector

```hcl
resource "google_vpc_access_connector" "connector" {
  name          = "erp-vpc-connector"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"   # 16 IPs (nhỏ nhất có thể)
  machine_type  = "e2-micro"       # VM nhỏ nhất
  min_instances = 2                # Tối thiểu 2 VM (yêu cầu của GCP)
  max_instances = 3                # Tối đa 3 VM
}
```

| Thuộc tính | Giá trị | Giải thích |
|---|---|---|
| `ip_cidr_range` | `10.8.0.0/28` | 16 IPs — dải nhỏ nhất (`/28`), tách biệt hoàn toàn với subnet `10.0.0.0/24` và reserved range |
| `machine_type` | `e2-micro` | VM nhỏ nhất để tiết kiệm (~$7/month) |
| `min_instances` | `2` | GCP yêu cầu tối thiểu 2 (để đảm bảo tính sẵn sàng) |
| `max_instances` | `3` | Giới hạn scaling để kiểm soát chi phí |

**Đây là component tốn tiền duy nhất trong networking:** ~$7/month cho 2 VM `e2-micro` chạy 24/7.

---

## 3. Cách Cloud Run sử dụng VPC Connector

Trong file `infra/environments/dev/main.tf`, module `cloud_run` truyền VPC Connector vào cho các backend service:

```hcl
module "cloud_run" {
  source   = "../../modules/cloud-run"
  for_each = local.all_services

  # Chỉ backend services (needs_vpc = true) mới dùng VPC Connector
  # Frontend KHÔNG cần vì nó không gọi trực tiếp tới Database
  vpc_connector = each.value.needs_vpc ? module.networking.vpc_connector_id : null
}
```

Bên trong module `cloud-run`, VPC Connector được cấu hình bằng dynamic block:

```hcl
dynamic "vpc_access" {
  for_each = var.vpc_connector != null ? [1] : []
  content {
    connector = var.vpc_connector
    egress    = "PRIVATE_RANGES_ONLY"  # Chỉ traffic private mới qua connector
  }
}
```

---

## 4. Tóm tắt luồng kết nối

```
1. Cloud Run (auth-service-dev) muốn gọi Cloud SQL
2. Request gửi đến private IP của Cloud SQL (vd: 10.64.1.5)
3. Vì egress = PRIVATE_RANGES_ONLY và IP bắt đầu bằng 10.x → đi qua VPC Connector
4. VPC Connector (10.8.0.0/28) chuyển tiếp vào VPC
5. VPC route traffic đến 10.64.0.0/20 → qua VPC Peering (Private Service Access)
6. Traffic đến Cloud SQL trong VPC của Google
7. Response đi ngược lại cùng đường
```

**Toàn bộ quá trình diễn ra qua mạng nội bộ — không bao giờ đi qua internet.**

## Related Concepts

- [VPC on GCP](./vpc-on-gcp.md) — lý thuyết về VPC Connector, Private Service Access
- [Core Concepts](./core-concepts.md) — 6 building blocks tổng quát
- [GCP Cloud Architecture](../../architecture/gcp-cloud-architecture.md) — kiến trúc tổng thể
