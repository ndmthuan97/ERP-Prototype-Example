---
type: Learning Note
title: "VPC & Cloud Networking Overview"
description: "Tổng quan VPC — tại sao cần mạng riêng, mô hình network trên cloud, vị trí trong cloud architecture"
tags: [learning, vpc, networking, cloud, gcp]
diataxis: explanation
timestamp: "2026-07-02T15:10:00+07:00"
---

# VPC & Cloud Networking Overview

## Summary

**VPC (Virtual Private Cloud)** là mạng riêng ảo của bạn trên cloud. Nó giống như việc bạn thuê một **tầng riêng trong toà nhà văn phòng** — bạn tự quyết ai được vào, ai bị chặn, các phòng nối với nhau thế nào.

```
┌──────────────────────────────────────────────────┐
│                  INTERNET                        │
│                     │                            │
│               ┌─────┴─────┐                      │
│               │ Firewall  │ ← Ai được vào?       │
│               └─────┬─────┘                      │
│                     │                            │
│  ┌──────────────────┴──────────────────────┐     │
│  │            YOUR VPC                      │     │
│  │                                          │     │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐ │     │
│  │  │ Web App  │  │ Database │  │ Cache  │ │     │
│  │  │ (public) │→ │(private) │  │(priv.) │ │     │
│  │  └──────────┘  └──────────┘  └────────┘ │     │
│  │                                          │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

## Key Concepts

### Tại sao cần VPC?

Không có VPC, mọi tài nguyên cloud của bạn sẽ nằm chung trên internet — ai cũng thấy, ai cũng gọi được. VPC giải quyết 3 vấn đề cốt lõi:

| Vấn đề | Không có VPC | Có VPC |
|---|---|---|
| **Bảo mật** | Database expose ra internet → bị scan/tấn công | Database chỉ có private IP → chỉ app trong VPC mới gọi được |
| **Kiểm soát** | Không biết traffic đi đâu về đâu | Firewall rules kiểm soát từng luồng traffic |
| **Cô lập** | Dev/Staging/Prod lẫn lộn | Mỗi môi trường 1 VPC riêng biệt |

### Analogy: VPC như toà nhà văn phòng

| Thế giới thật | Cloud Networking |
|---|---|
| Toà nhà | VPC |
| Tầng / khu vực | Subnet |
| Bảo vệ toà nhà | Firewall Rules |
| Thẻ ra vào | IAM / Security Groups |
| Hành lang nối giữa 2 tầng | Routes |
| Cầu nối giữa 2 toà nhà | VPC Peering |
| Đường hầm bí mật ra ngoài | VPN / Private Service Access |
| Phòng tiếp khách (public) | Public Subnet |
| Phòng server (restricted) | Private Subnet |

### VPC trên mỗi Cloud Provider

Mỗi cloud có cách triển khai hơi khác nhau, nhưng mental model giống nhau:

| Khái niệm | AWS | GCP | Azure |
|---|---|---|---|
| Mạng riêng ảo | VPC | VPC Network | VNet |
| Phạm vi | Regional | **Global** | Regional |
| Chia nhỏ | Subnet (per AZ) | Subnet (per Region) | Subnet |
| Firewall | Security Groups + NACLs | Firewall Rules | NSGs |
| Kết nối private services | VPC Endpoints | Private Service Access | Private Endpoints |
| Kết nối serverless → VPC | Lambda VPC config | **VPC Connector** | VNet Integration |

> [!IMPORTANT]
> **GCP VPC là Global** — một VPC trải rộng tất cả regions. Đây là điểm khác biệt lớn nhất so với AWS/Azure (regional VPC). Subnets trên GCP mới là regional.

### Vị trí VPC trong Cloud Architecture

```
User Request
     │
     ▼
┌─────────────┐
│ Load Balancer│ ← Public IP, nhận traffic từ internet
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│                   V P C                       │
│                                               │
│  ┌─────────────────────┐  ┌────────────────┐ │
│  │  Public Subnet       │  │ Private Subnet │ │
│  │  • Web Server        │  │ • Database     │ │
│  │  • API Gateway       │→ │ • Cache        │ │
│  │  • Bastion Host      │  │ • Internal API │ │
│  └─────────────────────┘  └────────────────┘ │
│                                               │
└──────────────────────────────────────────────┘
```

VPC là **lớp nền tảng (foundation layer)** — bạn phải có VPC trước, rồi mới tạo database, containers, load balancers bên trong nó.

## Practical Application

Khi bạn cần:
- Database không bị expose ra internet → đặt trong Private Subnet + VPC
- Cloud Run (serverless) gọi được Database private → VPC Connector
- 2 project khác nhau nối mạng với nhau → VPC Peering
- Tách biệt dev/staging/prod → mỗi môi trường 1 VPC

## References

- [Google Cloud VPC Docs](https://cloud.google.com/vpc/docs/overview) — official documentation
- [AWS VPC Concepts](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) — so sánh cross-cloud

## Related Concepts

- [Core Concepts](./core-concepts.md) — 6 building blocks chi tiết
- [VPC on GCP](./vpc-on-gcp.md) — đặc thù Google Cloud
- [VPC in This Project](./vpc-in-this-project.md) — áp dụng thực tế
