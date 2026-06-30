# Terraform — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về Terraform (HashiCorp) theo nguyên tắc Pareto: 20% nội dung quan trọng nhất giúp nắm 80% năng lực thực chiến.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [IaC & Terraform Overview](./iac-and-terraform-overview.md) | Learning Note | Tổng quan IaC, mô hình declarative, vị trí trong DevOps |
| [Core Concepts](./core-concepts.md) | Concept Explanation | 5 khái niệm cốt lõi: Provider, Resource, State, Module, Variables/Outputs |
| [Core Workflow](./core-workflow.md) | Concept Explanation | Vòng đời init → plan → apply → destroy và CI/CD integration |
| [HCL Syntax & Project Structure](./hcl-syntax-and-structure.md) | Reference | Cú pháp HCL, variable types, expressions, cấu trúc project chuẩn |
| [Best Practices](./best-practices.md) | Learning Note | Quy tắc 80/20 cho State, Security, Code Organization, CI/CD |
| [Ecosystem 2025-2026](./ecosystem-2025-2026.md) | Comparison | BSL license, OpenTofu, so sánh Pulumi/CloudFormation/Ansible |
| [Command Cheat Sheet](./command-cheatsheet.md) | Reference | Bảng tra cứu nhanh tất cả lệnh Terraform hay dùng |

## Lộ trình đọc

1. **Bắt đầu**: [IaC & Terraform Overview](./iac-and-terraform-overview.md) → hiểu "tại sao"
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → hiểu 5 building blocks
3. **Thực hành**: [Core Workflow](./core-workflow.md) → biết cách sử dụng
4. **Tra cứu**: [HCL Syntax](./hcl-syntax-and-structure.md) + [Cheat Sheet](./command-cheatsheet.md)
5. **Nâng cao**: [Best Practices](./best-practices.md) + [Ecosystem](./ecosystem-2025-2026.md)
