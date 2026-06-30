---
type: Comparison
title: "Terraform Ecosystem 2025-2026"
description: "Bối cảnh BSL license, OpenTofu fork, và so sánh với Pulumi/CloudFormation/Ansible"
tags: [terraform, opentofu, comparison, licensing, ecosystem]
diataxis: explanation
timestamp: "2026-06-29T10:12:00+07:00"
---

# Terraform Ecosystem 2025-2026

## Overview

Bối cảnh Terraform đã thay đổi đáng kể từ 2023 với việc HashiCorp đổi license, IBM mua lại HashiCorp, và sự ra đời của OpenTofu. Bài viết phân tích tình hình hiện tại và so sánh với các công cụ IaC khác.

## Timeline sự kiện

| Mốc thời gian | Sự kiện | Ảnh hưởng |
|---|---|---|
| 8/2023 | HashiCorp đổi license: **MPL 2.0** → **BSL 1.1** | Cấm dùng Terraform để build sản phẩm cạnh tranh HC |
| 9/2023 | Cộng đồng fork → **OpenTofu** (Linux Foundation) | Alternative mở, giữ MPL 2.0 |
| 12/2024 | **IBM mua lại HashiCorp** | Enterprise re-evaluate IaC strategy |
| 2025–2026 | Terraform và OpenTofu song song tồn tại | Thị trường IaC phân mảnh |

> [!IMPORTANT]
> **BSL 1.1 có nghĩa gì cho bạn?**
> - Dùng Terraform **nội bộ** (internal infra automation) → **KHÔNG ảnh hưởng**
> - Build **SaaS/product thương mại** cạnh tranh với HashiCorp → **CẦN xem xét OpenTofu hoặc legal review**

## Comparison Matrix

### Terraform vs OpenTofu

| Tiêu chí | Terraform | OpenTofu |
|---------|-----------|----------|
| License | BSL 1.1 (source-available) | MPL 2.0 (open-source thuần) |
| Governance | HashiCorp / IBM | Linux Foundation |
| HCL compatible | ✅ | ✅ (drop-in replacement) |
| State compatible | ✅ | ✅ |
| Provider ecosystem | ✅ (cùng Registry) | ✅ (cùng providers) |
| Enterprise support | Terraform Cloud/Enterprise | Community + third-party vendors |
| Unique features (2025+) | Stacks, HCP integration | State encryption, early evaluation |

### Terraform vs Pulumi vs CloudFormation vs Ansible

| Tiêu chí | Terraform | Pulumi | CloudFormation | Ansible |
|---------|-----------|--------|----------------|---------|
| **Loại** | Provisioning (IaC) | Provisioning (IaC) | Provisioning (IaC) | Config Management |
| **Language** | HCL (domain-specific) | Python, TS, Go, C# | YAML / JSON | YAML |
| **Cloud support** | Multi-cloud (4000+ providers) | Multi-cloud | AWS only | Multi (via SSH) |
| **State** | Self-managed (S3, GCS...) | Managed (Pulumi Cloud) or self-hosted | Fully managed by AWS | Stateless (agentless) |
| **Learning curve** | Medium | Thấp (nếu biết Python/TS) | Medium | Thấp |
| **Ecosystem** | Lớn nhất | Đang phát triển | Lớn (AWS) | Lớn (config mgmt) |
| **Best for** | Multi-cloud teams, Platform eng. | Developer-heavy teams | 100% AWS | Install/configure software |

## Chi tiết

### Terraform

**Ưu điểm:**
- Ecosystem lớn nhất: 4000+ providers, hàng nghìn community modules
- Battle-tested trong production tại hầu hết Fortune 500
- HCL đơn giản, dễ audit hơn general-purpose code
- Tách biệt rõ infra code vs application code

**Nhược điểm:**
- BSL license gây lo ngại cho một số tổ chức
- HCL hạn chế khi cần logic phức tạp (loops, conditionals verbose)
- State management là trách nhiệm của user
- IBM acquisition tạo uncertainty dài hạn

### Pulumi

**Ưu điểm:**
- Dùng ngôn ngữ lập trình quen thuộc (Python, TypeScript, Go)
- IDE support tốt (autocompletion, type checking)
- Unit testing với framework quen thuộc (pytest, jest)
- Logic phức tạp viết dễ hơn HCL

**Nhược điểm:**
- Ecosystem nhỏ hơn Terraform
- Dễ "over-engineer" infrastructure code
- Khó audit hơn (code phức tạp = khó review)
- Managed state (Pulumi Cloud) hoặc self-host backend

### CloudFormation

**Ưu điểm:**
- Fully managed by AWS — không cần quản lý state
- Deep AWS integration (tính năng mới AWS support trước)
- Rollback tự động khi deploy fail
- Miễn phí

**Nhược điểm:**
- AWS only — không multi-cloud
- YAML/JSON verbose và khó đọc
- Slow iteration (chờ stack update lâu)
- Error messages khó hiểu

## Recommendation

| Tình huống | Chọn |
|-----------|------|
| Multi-cloud hoặc hybrid (AWS + GCP + K8s) | **Terraform** |
| Team developer, thích code Python/TS | **Pulumi** |
| 100% AWS, muốn zero state management | **CloudFormation** (hoặc AWS CDK) |
| Cài phần mềm lên servers (config management) | **Ansible** |
| Cần open-source thuần, tránh vendor lock-in | **OpenTofu** |
| Enterprise với HC investment, cần support | **Terraform** + Terraform Cloud |

> [!TIP]
> **Terraform vẫn là "safe bet" cho hầu hết teams** — ecosystem lớn nhất, community mạnh nhất, hiring dễ nhất. Chỉ cần lưu ý BSL license nếu bạn build SaaS product.

## Related Concepts

- [IaC & Terraform Overview](./iac-and-terraform-overview.md)
- [Best Practices](./best-practices.md)
- [Command Cheat Sheet](./command-cheatsheet.md)
