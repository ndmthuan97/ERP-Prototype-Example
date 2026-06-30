---
type: Learning Note
title: "Infrastructure as Code & Terraform Overview"
description: "Tổng quan IaC và Terraform — mô hình declarative, vị trí trong hệ sinh thái DevOps"
tags: [learning, terraform, iac, devops]
diataxis: explanation
timestamp: "2026-06-29T10:12:00+07:00"
---

# Infrastructure as Code & Terraform Overview

## Summary

**Terraform** (HashiCorp) là công cụ **Infrastructure as Code (IaC)** cho phép khai báo hạ tầng bằng code (file `.tf`), rồi tự động tạo/cập nhật/xóa tài nguyên trên **bất kỳ cloud nào** (AWS, Azure, GCP, Kubernetes...) thông qua API.

```
┌──────────────────────────────────────────────┐
│   Bạn viết code (.tf)                        │
│   "Tôi muốn 1 VM, 1 DB, 1 Load Balancer"    │
│                     │                        │
│                     ▼                        │
│          Terraform Engine                    │
│     (đọc code → so sánh state → plan)        │
│                     │                        │
│                     ▼                        │
│   Cloud API (AWS / Azure / GCP / ...)        │
│   → Tạo/sửa/xóa tài nguyên thật             │
└──────────────────────────────────────────────┘
```

## Key Concepts

### Infrastructure as Code (IaC) là gì?

IaC là phương pháp quản lý hạ tầng (servers, networks, databases...) bằng **code versionable** thay vì click tay trên cloud console.

| Click tay (manual) | Terraform (IaC) |
|---|---|
| Không lặp lại được | Chạy lại 100 lần cho kết quả giống nhau |
| Không audit được ai sửa gì | Git log = lịch sử thay đổi hạ tầng |
| Dễ sai lệch giữa dev/staging/prod | Cùng 1 code, khác biến = nhất quán |
| Scale 50 server = 50 lần click | Scale 50 server = sửa 1 con số |

### Declarative vs Imperative — Mental Model nền tảng

| | Imperative (Ansible, scripts) | Declarative (Terraform) |
|---|---|---|
| **Bạn nói** | "Hãy tạo VM, rồi gắn IP, rồi mở port..." | "Tôi muốn có 3 VM với IP public và port 443" |
| **Ai lo thứ tự?** | Bạn | Terraform |
| **Chạy lại?** | Có thể bị trùng/lỗi | Idempotent — chạy bao nhiêu lần cũng ra cùng kết quả |

> [!IMPORTANT]
> **Terraform là Declarative**: bạn mô tả **trạng thái mong muốn** (desired state), Terraform tự tính toán cách đạt được nó. Đây là khác biệt cốt lõi so với shell script hay Ansible.

### Vị trí Terraform trong DevOps

```
Code → Build → Test → Deploy → Operate → Monitor
                        ▲
                        │
              ┌─────────┴──────────┐
              │    TERRAFORM        │
              │  (Provisioning)     │
              │                     │
              │  Tạo/quản lý:       │
              │  • VMs, containers  │
              │  • Networks, DNS    │
              │  • Databases        │
              │  • Load balancers   │
              │  • IAM policies     │
              └─────────────────────┘
```

Terraform thuộc bước **Provisioning** — tạo hạ tầng. Nó **không** cài phần mềm lên server (đó là việc của Ansible/Chef/Puppet — Configuration Management).

## Practical Application

Khi bạn cần:
- Tạo môi trường dev/staging/prod giống nhau → Terraform
- Quản lý hạ tầng multi-cloud (AWS + GCP) → Terraform
- Audit ai sửa gì, rollback hạ tầng → Terraform + Git
- Scale hạ tầng nhanh (from 2 → 50 servers) → Terraform

## References

- [HashiCorp Terraform Docs](https://developer.hashicorp.com/terraform/docs) — official documentation
- [Terraform Registry](https://registry.terraform.io/) — providers & modules marketplace

## Related Concepts

- [Core Concepts](./core-concepts.md)
- [Core Workflow](./core-workflow.md)
- [Best Practices](./best-practices.md)
