---
type: Concept Explanation
title: "VPC on Google Cloud Platform"
description: "Đặc thù VPC trên GCP: global VPC, auto/custom mode, VPC Connector, Private Service Access, Cloud NAT"
tags: [vpc, gcp, networking, vpc-connector, private-service-access, cloud-nat]
diataxis: explanation
timestamp: "2026-07-02T15:10:00+07:00"
---

# VPC on Google Cloud Platform

## Định nghĩa

GCP VPC có nhiều **đặc thù riêng** so với AWS/Azure. Hiểu rõ chúng sẽ tránh được rất nhiều lỗi cấu hình thường gặp.

## Tại sao quan trọng

Nếu bạn áp kiến thức AWS VPC sang GCP một cách máy móc, bạn sẽ gặp lỗi — vì GCP VPC hoạt động khác ở nhiều điểm then chốt (global scope, implied firewall rules, serverless VPC access model).

## Cách hoạt động

### 1. Global VPC — Điểm khác biệt lớn nhất

```
AWS / Azure VPC:                    GCP VPC:
┌─── VPC (us-east-1) ──┐          ┌──── VPC (GLOBAL) ────────────┐
│  Subnet-1a            │          │                              │
│  Subnet-1b            │          │  Subnet-A (us-central1)     │
└───────────────────────┘          │  Subnet-B (asia-southeast1) │
                                   │  Subnet-C (europe-west1)    │
┌─── VPC (eu-west-1) ──┐          │                              │
│  Subnet-1a            │          │  → Tất cả trong CÙNG 1 VPC  │
│  Subnet-1b            │          │  → Route/Firewall global     │
└───────────────────────┘          └──────────────────────────────┘
```

> [!IMPORTANT]
> **GCP VPC là global** — một VPC bao trùm tất cả regions. Subnets mới là regional. Điều này đơn giản hoá việc kết nối cross-region so với AWS (không cần VPC Peering giữa các regions).

### 2. Auto Mode vs Custom Mode

GCP cho phép 2 chế độ tạo VPC:

| Chế độ | Auto Mode | Custom Mode |
|---|---|---|
| Subnet | Tự tạo 1 subnet ở mỗi region | Bạn tự tạo, chọn region + CIDR |
| CIDR | `10.128.0.0/20` (fixed per region) | Bạn tự chọn |
| Dùng khi | Test nhanh, prototype | **Production** (recommended) |
| Nhược điểm | CIDR có thể conflict khi peering | Phải tự khai báo |

```hcl
# Custom mode — recommended cho production
resource "google_compute_network" "vpc" {
  name                    = "erp-vpc-dev"
  auto_create_subnetworks = false  # Custom mode
}

resource "google_compute_subnetwork" "main" {
  name          = "erp-subnet-dev"
  region        = "us-central1"
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"   # Bạn tự chọn
}
```

> [!TIP]
> **Luôn dùng Custom mode** cho project thật. Auto mode tạo subnet ở mọi region (lãng phí) và dải CIDR cố định dễ bị conflict khi peering.

---

### 3. GCP Firewall Rules — Đặc thù

GCP firewall rules áp dụng ở **mức VPC** (không phải mức subnet như AWS):

```
┌──── VPC ──────────────────────────────────────┐
│                                                │
│  Firewall Rules (áp dụng cho TOÀN BỘ VPC)     │
│  ┌────────────────────────────────────────┐    │
│  │ Rule 1: Allow TCP:443 from 0.0.0.0/0  │    │
│  │ Rule 2: Allow TCP:5432 from tag:app    │    │
│  │ Rule 3: Deny all (default, priority    │    │
│  │         65535, lowest)                 │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  Subnet A             Subnet B                 │
│  (rules apply here)   (rules apply here too)   │
└────────────────────────────────────────────────┘
```

**Mặc định:**
- Chặn tất cả ingress (vào)
- Cho phép tất cả egress (ra)
- Cho phép traffic nội bộ giữa các VM **cùng VPC**

**Target filtering** dùng **Network Tags** hoặc **Service Accounts** (thay vì Security Groups như AWS):

```hcl
resource "google_compute_firewall" "allow_db" {
  name    = "allow-db-from-app"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  source_tags = ["app-server"]    # Chỉ VM có tag "app-server"
  target_tags = ["database"]      # Chỉ áp dụng cho VM có tag "database"
}
```

---

### 4. Private Service Access — Kết nối Managed Services

Nhiều managed services của Google (Cloud SQL, Memorystore, Filestore) chạy trong **VPC riêng của Google**. Để app của bạn gọi được chúng qua private IP, cần **Private Service Access**.

```
┌── Your VPC ──────────┐         ┌── Google's VPC ─────────┐
│  10.0.0.0/16          │         │                         │
│                       │         │  ┌─────────────────┐   │
│  App ─────────────────┼── PSA ──┼─→│ Cloud SQL        │   │
│                       │ Peering │  │ (private IP:     │   │
│  Reserved IP range:   │         │  │  10.64.x.x)      │   │
│  10.64.0.0/20         │         │  └─────────────────┘   │
└───────────────────────┘         └─────────────────────────┘
```

**Terraform setup:**

```hcl
# Đặt trước 1 dải IP cho Google peering
resource "google_compute_global_address" "private_ip_range" {
  name          = "erp-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20           # 4096 IPs cho managed services
  network       = google_compute_network.vpc.id
}

# Tạo kết nối peering
resource "google_service_networking_connection" "private_service" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}
```

---

### 5. VPC Connector — Cầu nối Serverless → VPC

**Vấn đề:** Cloud Run, Cloud Functions, App Engine chạy **ngoài VPC** (trên hạ tầng serverless của Google). Chúng không tự gọi được tài nguyên private trong VPC.

**Giải pháp:** VPC Connector — một cầu nối nhỏ gồm 2-3 VM `e2-micro` làm proxy giữa serverless và VPC.

```
┌── Serverless (Cloud Run) ──┐     ┌──── Your VPC ──────────┐
│                             │     │                         │
│  auth-service-dev          │     │  ┌─────────────────┐   │
│  customer-service-dev      │─────┼─→│ VPC Connector   │   │
│  sales-service-dev         │     │  │ (e2-micro VMs)  │   │
│  inventory-service-dev     │     │  │ 10.8.0.0/28     │   │
│  (egress: PRIVATE_RANGES   │     │  └───────┬─────────┘   │
│   _ONLY)                   │     │          │              │
└─────────────────────────────┘     │          ▼              │
                                    │  Cloud SQL (private IP) │
                                    └─────────────────────────┘
```

**Terraform:**

```hcl
resource "google_vpc_access_connector" "connector" {
  name          = "erp-vpc-connector"
  region        = "us-central1"
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"  # 16 IPs, không overlap với subnet khác
  machine_type  = "e2-micro"     # Nhỏ nhất, ~$7/month
  min_instances = 2
  max_instances = 3
}
```

**Egress modes** (traffic nào đi qua connector):

| Mode | Ý nghĩa | Khi nào dùng |
|---|---|---|
| `PRIVATE_RANGES_ONLY` | Chỉ traffic đến IP private (10.x, 172.x, 192.168.x) đi qua connector | **Recommended** — tiết kiệm, đủ cho Cloud SQL |
| `ALL_TRAFFIC` | Mọi traffic đều đi qua connector → VPC | Khi cần Cloud NAT (IP cố định) cho tất cả outbound |

> [!WARNING]
> VPC Connector luôn chạy (always-on, không scale-to-zero), tốn ~$7/month ngay cả khi Cloud Run scale xuống 0. Đây là chi phí cố định duy nhất trong kiến trúc serverless.

---

### 6. Cloud NAT — IP cố định cho outbound traffic

Mặc định, Cloud Run dùng IP ngẫu nhiên mỗi lần gọi ra ngoài. Nếu bạn cần IP cố định (ví dụ: whitelist IP với bên thứ 3), cần **Cloud NAT**.

```
Cloud Run → VPC Connector → Cloud NAT → Internet
(egress: ALL_TRAFFIC)       (IP cố định: 34.x.x.x)
```

> [!NOTE]
> Dự án ERP hiện tại **không dùng Cloud NAT** vì không cần IP cố định. Upstash Redis gọi qua HTTPS public. Cloud SQL gọi qua private IP (VPC Connector, không cần NAT).

## Bảng tổng kết

| Component | Vai trò | Chi phí |
|---|---|---|
| VPC Network | Mạng nền tảng | Free |
| Subnet | Chia vùng trong VPC | Free |
| Firewall Rules | Kiểm soát traffic | Free |
| Private Service Access | Kết nối Cloud SQL qua private IP | Free |
| VPC Connector | Cloud Run → VPC | ~$7/month (always-on e2-micro) |
| Cloud NAT | IP cố định cho outbound | ~$1/month + data processing |

## Related Concepts

- [Core Concepts](./core-concepts.md) — 6 building blocks tổng quát
- [VPC & Networking Overview](./vpc-and-networking-overview.md) — tại sao cần VPC
- [VPC in This Project](./vpc-in-this-project.md) — áp dụng trong dự án ERP
