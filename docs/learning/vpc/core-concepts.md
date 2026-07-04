---
type: Concept Explanation
title: "VPC Core Concepts"
description: "6 building blocks của cloud networking: VPC, Subnet, CIDR, Firewall Rules, Routes, Peering"
tags: [vpc, networking, subnet, cidr, firewall, routes, peering]
diataxis: explanation
timestamp: "2026-07-02T15:10:00+07:00"
---

# VPC Core Concepts

## Định nghĩa

Cloud networking xây dựng trên **6 khái niệm cốt lõi**. Nắm 6 cái này = hiểu 80% cách mạng cloud hoạt động.

## Tại sao quan trọng

Mọi cloud architecture đều cần networking. Không hiểu VPC = không giải thích được tại sao database timeout, service gọi nhau bị 404, hay tại sao phải cần VPC Connector.

## Cách hoạt động

### 1. VPC — Mạng riêng ảo

VPC là một mạng logic hoàn toàn cô lập. Traffic giữa 2 VPC khác nhau **không** thể đi qua nhau (trừ khi bạn cho phép qua Peering).

```
┌─── VPC A (Production) ────┐    ┌─── VPC B (Development) ────┐
│  10.0.0.0/16               │    │  10.1.0.0/16               │
│  ┌────────┐ ┌────────┐    │    │  ┌────────┐ ┌────────┐    │
│  │ App    │ │ DB     │    │    │  │ App    │ │ DB     │    │
│  └────────┘ └────────┘    │    │  └────────┘ └────────┘    │
└────────────────────────────┘    └────────────────────────────┘
         ╳ Không kết nối được (mặc định)
```

**Key properties:**
- Mỗi VPC có một dải IP riêng (CIDR block)
- Mặc định, các tài nguyên trong cùng VPC nói chuyện được với nhau
- Mặc định, VPC không kết nối ra internet (phải cấu hình thêm)

---

### 2. Subnet — Chia nhỏ VPC

Subnet là phân vùng con trong VPC, dùng để **tách biệt vai trò** của tài nguyên.

```
┌─────────────── VPC (10.0.0.0/16) ───────────────┐
│                                                   │
│  ┌─── Public Subnet ────┐  ┌── Private Subnet ──┐│
│  │  10.0.1.0/24          │  │ 10.0.2.0/24        ││
│  │                       │  │                     ││
│  │  • Web Server         │  │ • Database          ││
│  │  • Load Balancer      │→ │ • Internal API      ││
│  │  • Bastion Host       │  │ • Cache             ││
│  │  (có Internet access) │  │ (KHÔNG có Internet) ││
│  └───────────────────────┘  └─────────────────────┘│
└───────────────────────────────────────────────────┘
```

**Public vs Private Subnet:**

| Đặc điểm | Public Subnet | Private Subnet |
|---|---|---|
| Có Internet Gateway? | ✅ Có | ❌ Không |
| Tài nguyên có public IP? | Có thể | Không bao giờ |
| Dùng cho | Web server, Load Balancer | Database, internal services |
| Ai truy cập được? | Internet → vào | Chỉ resources trong VPC |

---

### 3. CIDR — Cách đánh số IP

CIDR (Classless Inter-Domain Routing) là cách ký hiệu một dải địa chỉ IP. Bạn **phải** hiểu CIDR để cấu hình VPC/Subnet.

```
    10.0.0.0/24
    ├── 10.0.0    = network prefix (cố định)
    └── /24       = 24 bits cố định → còn 8 bits cho hosts
                  → 2^8 = 256 địa chỉ (thực tế dùng ~254)
```

**Bảng tra cứu nhanh:**

| CIDR | Số IP khả dụng | Dùng khi |
|---|---|---|
| `/28` | 16 | VPC Connector, nhóm nhỏ |
| `/24` | 256 | 1 subnet thông thường |
| `/20` | 4,096 | Dải IP cho peering (Cloud SQL) |
| `/16` | 65,536 | Toàn bộ VPC |

> [!TIP]
> **Quy tắc nhớ nhanh:** `/X` càng nhỏ → dải IP càng lớn. `/16` = rất lớn (65K IPs). `/28` = rất nhỏ (16 IPs).

**Quy tắc quan trọng:** Các dải CIDR trong cùng VPC **không được trùng lấn** (overlap). Ví dụ `10.0.0.0/24` và `10.0.0.0/28` trùng nhau → lỗi.

---

### 4. Firewall Rules — Bảo vệ chặn/cho phép traffic

Firewall rules kiểm soát **traffic nào được vào, traffic nào được ra** tại mức VPC.

```
Internet ──→ [Firewall: allow port 443] ──→ Web Server
                                              │
                                     [Firewall: allow port 5432
                                      from web-server-tag only]
                                              │
                                              ▼
                                           Database
```

**Cấu trúc 1 rule:**

| Thuộc tính | Ý nghĩa | Ví dụ |
|---|---|---|
| Direction | Ingress (vào) hay Egress (ra) | `INGRESS` |
| Action | Cho phép hay chặn | `ALLOW` |
| Source | Traffic đến từ đâu | `0.0.0.0/0` (tất cả) hoặc tag/IP cụ thể |
| Target | Áp dụng cho ai | Tag `web-server` |
| Protocol/Port | Giao thức và cổng | `tcp:443` (HTTPS) |
| Priority | Số nhỏ = ưu tiên cao hơn | `1000` |

> [!IMPORTANT]
> **GCP mặc định chặn tất cả Ingress, cho phép tất cả Egress.** Bạn chỉ cần viết rule cho phép traffic vào — traffic ra đã được mở sẵn.

---

### 5. Routes — Đường đi của traffic

Routes quy định **traffic đi đâu**. Giống như biển chỉ đường trên đường cao tốc.

```
Packet đến từ 10.0.1.5, muốn đi tới:

  10.0.2.0/24  → Route: đi qua internal network (cùng VPC)
  0.0.0.0/0    → Route: đi qua Internet Gateway (ra ngoài)
  10.8.0.0/28  → Route: đi qua VPC Connector
```

**Trong thực tế:** GCP tự động tạo routes cho bạn trong hầu hết trường hợp. Bạn chỉ cần tạo custom routes khi có yêu cầu đặc biệt (VPN, hybrid cloud).

---

### 6. VPC Peering — Nối 2 VPC với nhau

VPC Peering cho phép 2 VPC **nói chuyện trực tiếp** với nhau qua internal network (không đi qua internet).

```
┌── VPC A ──────────┐         ┌── VPC B ──────────┐
│  10.0.0.0/16       │◄──────►│  10.1.0.0/16       │
│  (Your App)        │ Peering│  (Managed Service)  │
│                    │        │  (Cloud SQL)         │
└────────────────────┘        └─────────────────────┘
```

**Use case phổ biến nhất:** Cloud SQL (managed database) chạy trong VPC riêng của Google. Bạn cần VPC Peering (thông qua Private Service Access) để app trong VPC của bạn gọi được DB mà không cần đi qua internet.

## Ví dụ thực tế

### Kết hợp 6 concepts trong một VPC design

```
┌──────────────── VPC: 10.0.0.0/16 ──────────────────────┐
│                                                          │
│  Subnet A (10.0.1.0/24)     Subnet B (10.0.2.0/24)     │
│  ┌──────────────────┐       ┌──────────────────────┐    │
│  │ Web Servers       │──────│ Database (Private IP) │    │
│  │ (Firewall: 443)  │      │ (Firewall: 5432 from │    │
│  │                   │      │  subnet A only)       │    │
│  └──────────────────┘       └──────────────────────┘    │
│            │                          ▲                   │
│      [Route: 0.0.0.0/0              [VPC Peering]        │
│       → Internet GW]                 │                   │
│            │                   ┌─────┴──────┐            │
│            ▼                   │ Cloud SQL  │            │
│       Internet                 │ (Google's  │            │
│                                │  VPC)      │            │
│                                └────────────┘            │
└──────────────────────────────────────────────────────────┘
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|------------|----------------|
| Service A không gọi được Service B | Khác VPC hoặc thiếu Firewall rule | Kiểm tra cùng VPC + mở port cần thiết |
| CIDR overlap | 2 subnet dùng trùng dải IP | Đổi dải IP cho 1 trong 2 |
| Database timeout từ Cloud Run | Cloud Run nằm ngoài VPC | Thêm VPC Connector |
| Peering bị lỗi | CIDR overlap giữa 2 VPC | Đảm bảo 2 VPC dùng dải IP khác nhau |
| Serverless → VPC chậm | Cold start + VPC Connector overhead | Tăng min instances hoặc dùng Direct VPC Egress |

## Related Concepts

- [VPC & Networking Overview](./vpc-and-networking-overview.md) — tại sao cần VPC
- [VPC on GCP](./vpc-on-gcp.md) — đặc thù Google Cloud
- [VPC in This Project](./vpc-in-this-project.md) — áp dụng trong dự án ERP
