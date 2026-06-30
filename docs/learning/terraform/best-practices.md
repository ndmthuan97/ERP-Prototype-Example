---
type: Learning Note
title: "Terraform Best Practices"
description: "Quy tắc 80/20 cho State, Security, Code Organization, và CI/CD"
tags: [terraform, best-practices, state-management, security, cicd]
diataxis: how-to
timestamp: "2026-06-29T10:12:00+07:00"
---

# Terraform Best Practices

## Summary

Tập hợp các best practices quan trọng nhất khi sử dụng Terraform trong production, phân theo 4 domain: State Management, Security, Code Organization, và Workflow/CI/CD.

## Key Concepts

### 1. State Management — Domain quan trọng nhất

State là nơi gây lỗi nhiều nhất. Tuân thủ các quy tắc sau:

**Remote Backend + Locking:**

```hcl
# backend.tf — Example: AWS S3
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/networking/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    # S3 native locking (Terraform >= 1.10)
    use_lockfile   = true
  }
}
```

**Tách State theo Environment và Component:**

```
State files:
├── dev/networking/terraform.tfstate
├── dev/compute/terraform.tfstate
├── dev/database/terraform.tfstate
├── staging/networking/terraform.tfstate
├── staging/compute/terraform.tfstate
├── prod/networking/terraform.tfstate
├── prod/compute/terraform.tfstate
└── prod/database/terraform.tfstate
```

> [!CAUTION]
> **Blast radius**: nếu toàn bộ production dùng 1 state file, một lỗi sẽ ảnh hưởng tất cả. Tách state = giới hạn thiệt hại khi sự cố xảy ra.

**Versioning trên Storage:**

Bật versioning trên S3/GCS bucket chứa state → rollback được nếu state bị corrupt.

---

### 2. Security

| Rule | Mô tả |
|------|-------|
| **Encrypt state at rest** | State chứa plaintext secrets (DB passwords, API keys) |
| **Restrict IAM access** | Chỉ CI/CD service account mới đọc/ghi state bucket |
| **Không hardcode secrets** | Dùng environment variables, Vault, hoặc AWS Secrets Manager |
| **`sensitive = true`** | Đánh dấu variables nhạy cảm để ẩn trong plan output |
| **Least privilege** | Terraform credentials chỉ có quyền tối thiểu cần thiết |

```hcl
variable "db_password" {
  type      = string
  sensitive = true  # Hidden in plan/apply output
}

# Inject via environment variable
# export TF_VAR_db_password="super-secret"
```

---

### 3. Code Organization

**Pin EVERYTHING:**

```hcl
terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"    # Allows 5.x, blocks 6.0
    }
  }
}
```

**Module hóa:**

| Khi nào dùng module | Khi nào KHÔNG cần |
|---------------------|-------------------|
| Pattern lặp lại >= 2 lần | Resource chỉ dùng 1 lần |
| Cần enforce standards cho team | Prototype / learning |
| Chia ownership giữa các team | Dưới 50 resources |

**Naming conventions:**

```hcl
# Resources: snake_case, mô tả rõ
resource "aws_security_group" "web_server_sg" { ... }

# Variables: snake_case
variable "instance_count" { ... }

# Outputs: snake_case, prefix = resource type
output "web_server_public_ip" { ... }

# Tags: consistent, always include ManagedBy
tags = {
  Name        = "web-server-prod"
  Environment = var.environment
  ManagedBy   = "terraform"
  Team        = "platform"
}
```

---

### 4. Workflow & CI/CD

**PR-based workflow (golden standard):**

```
1. Developer tạo branch, sửa .tf files
2. Push → CI chạy:
   - terraform fmt -check
   - terraform validate
   - terraform plan → post kết quả lên PR comment
3. Reviewer xem plan, approve PR
4. Merge → CD chạy:
   - terraform apply (auto-approve, vì đã review)
5. Notify kết quả qua Slack/Teams
```

**Policy as Code — Guardrails tự động:**

Dùng **OPA (Open Policy Agent)** hoặc **Sentinel** để enforce rules:

```
# Example policies:
✓ Không cho tạo EC2 instance type lớn hơn t3.xlarge
✓ Mọi S3 bucket phải enable encryption
✓ Mọi security group không được mở port 22 cho 0.0.0.0/0
✓ Mọi resource phải có tag "ManagedBy" = "terraform"
```

---

### 5. Anti-Patterns cần tránh

| ❌ Anti-Pattern | ✅ Nên làm |
|----------------|-----------|
| Monolith state (tất cả trong 1 file state) | Tách state theo environment + component |
| `terraform apply` trên laptop | CI/CD pipeline only |
| Copy-paste resource blocks | Module hóa |
| Hardcode values | Variables + tfvars |
| `terraform apply -auto-approve` không review | Luôn review plan trước |
| Không commit `.terraform.lock.hcl` | Luôn commit lock file |
| Store secrets trong `.tfvars` committed | Env vars hoặc secret manager |

## Practical Application

### Checklist trước khi apply vào Production

- [ ] `terraform fmt -check` pass
- [ ] `terraform validate` pass
- [ ] `terraform plan` đã được review bởi >=1 team member
- [ ] Không có `-destroy` ngoài ý muốn trong plan
- [ ] Sensitive values không hiện trong plan output
- [ ] State backend đã encrypt + locking
- [ ] Policy checks (OPA/Sentinel) pass
- [ ] Rollback plan đã sẵn sàng

## References

- [Terraform Best Practices](https://www.terraform-best-practices.com/) — community-maintained guide
- [HashiCorp Recommended Practices](https://developer.hashicorp.com/terraform/cloud-docs/recommended-practices) — official guide

## Related Concepts

- [Core Concepts](./core-concepts.md)
- [Core Workflow](./core-workflow.md)
- [Terraform Ecosystem 2025-2026](./ecosystem-2025-2026.md)
