# VPC & Cloud Networking — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về VPC (Virtual Private Cloud) và mạng trên Cloud theo nguyên tắc Pareto: 20% nội dung quan trọng nhất giúp nắm 80% năng lực thực chiến. Focus vào Google Cloud nhưng mental model áp dụng cho mọi cloud provider.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [VPC & Networking Overview](./vpc-and-networking-overview.md) | Learning Note | Tổng quan VPC, tại sao cần mạng riêng, vị trí trong cloud architecture |
| [Core Concepts](./core-concepts.md) | Concept Explanation | 6 building blocks: VPC, Subnet, CIDR, Firewall Rules, Routes, Peering |
| [VPC on GCP](./vpc-on-gcp.md) | Concept Explanation | Đặc thù GCP: global VPC, auto/custom mode, VPC Connector, Private Service Access |
| [VPC in This Project](./vpc-in-this-project.md) | Reference | Mapping lý thuyết → Terraform code thực tế trong dự án ERP Prototype |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Các lỗi hay gặp khi làm VPC trên GCP + Cloud Run, cách xử lý |

## Lộ trình đọc

1. **Bắt đầu**: [VPC & Networking Overview](./vpc-and-networking-overview.md) → hiểu "tại sao"
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → hiểu 6 building blocks
3. **GCP cụ thể**: [VPC on GCP](./vpc-on-gcp.md) → đặc thù Google Cloud
4. **Áp dụng**: [VPC in This Project](./vpc-in-this-project.md) → code thực tế
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) → xử lý lỗi
