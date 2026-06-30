---
type: Reference
title: "Terraform Command Cheat Sheet"
description: "Bảng tra cứu nhanh các lệnh Terraform hay dùng"
tags: [terraform, cheatsheet, reference, cli]
diataxis: reference
timestamp: "2026-06-29T10:12:00+07:00"
---

# Terraform Command Cheat Sheet

## Quick Reference

### Workflow cơ bản

| Lệnh | Mô tả |
|-------|-------|
| `terraform init` | Khởi tạo, download providers/modules |
| `terraform plan` | Preview thay đổi (không sửa gì trên cloud) |
| `terraform plan -out=plan.tfplan` | Lưu plan ra file để apply chính xác |
| `terraform apply` | Thực thi thay đổi (hỏi xác nhận) |
| `terraform apply plan.tfplan` | Apply đúng plan đã review |
| `terraform apply -auto-approve` | Apply không hỏi (chỉ dùng trong CI/CD) |
| `terraform destroy` | Xóa toàn bộ resources trong state |
| `terraform destroy -target=aws_instance.web` | Xóa 1 resource cụ thể |

### Validation & Formatting

| Lệnh | Mô tả |
|-------|-------|
| `terraform fmt` | Format code theo chuẩn HCL |
| `terraform fmt -recursive` | Format toàn bộ subdirectories |
| `terraform fmt -check` | Kiểm tra format (CI/CD) — exit 1 nếu sai |
| `terraform validate` | Kiểm tra syntax và internal consistency |
| `terraform console` | REPL để test expressions |

### State Management

| Lệnh | Mô tả |
|-------|-------|
| `terraform state list` | Liệt kê tất cả resources trong state |
| `terraform state show aws_instance.web` | Xem chi tiết 1 resource |
| `terraform state mv old_name new_name` | Đổi tên resource trong state (không xóa thật) |
| `terraform state rm aws_instance.old` | Bỏ resource khỏi state (không xóa trên cloud) |
| `terraform state pull` | Download remote state về stdout |
| `terraform state push` | Upload local state lên remote backend |
| `terraform import aws_instance.web i-123456` | Import resource có sẵn trên cloud vào state |
| `terraform force-unlock LOCK_ID` | Mở khóa state bị lock (cẩn thận!) |

### Inspect & Debug

| Lệnh | Mô tả |
|-------|-------|
| `terraform output` | Hiện tất cả output values |
| `terraform output web_url` | Hiện 1 output cụ thể |
| `terraform output -json` | Output dạng JSON (scripting) |
| `terraform show` | Hiện state hoặc plan file |
| `terraform graph` | Tạo dependency graph (DOT format) |
| `terraform providers` | Liệt kê providers đang dùng |
| `terraform version` | Hiện version Terraform + providers |

### Workspace Management

| Lệnh | Mô tả |
|-------|-------|
| `terraform workspace list` | Liệt kê workspaces |
| `terraform workspace new staging` | Tạo workspace mới |
| `terraform workspace select prod` | Chuyển workspace |
| `terraform workspace show` | Hiện workspace hiện tại |
| `terraform workspace delete staging` | Xóa workspace |

### Taint & Replace

| Lệnh | Mô tả |
|-------|-------|
| `terraform apply -replace=aws_instance.web` | Force recreate resource (Terraform >= 0.15.2) |
| `terraform taint aws_instance.web` | Mark resource để recreate (deprecated, dùng `-replace`) |
| `terraform untaint aws_instance.web` | Bỏ mark taint |

### Testing (Terraform >= 1.6)

| Lệnh | Mô tả |
|-------|-------|
| `terraform test` | Chạy test files (`.tftest.hcl`) |
| `terraform test -filter=tests/vpc.tftest.hcl` | Chạy 1 test file cụ thể |

## Examples

### Combo hay dùng nhất

```bash
# First time setup
terraform init
terraform plan
terraform apply

# Daily workflow
terraform plan -out=plan.tfplan    # Save plan
terraform apply plan.tfplan        # Apply exact plan

# Import existing resource
terraform import aws_instance.web i-0abc123def456

# Rename resource without recreate
terraform state mv aws_instance.old_name aws_instance.new_name

# Visualize dependency graph
terraform graph | dot -Tpng > graph.png

# Clean format check in CI
terraform fmt -check -recursive && terraform validate
```

### Environment Variables hay dùng

```bash
# Set variable values
export TF_VAR_region="ap-southeast-1"
export TF_VAR_db_password="secret"

# Logging
export TF_LOG=DEBUG          # DEBUG, TRACE, INFO, WARN, ERROR
export TF_LOG_PATH=terraform.log

# Parallelism (default 10)
export TF_CLI_ARGS_apply="-parallelism=5"

# Auto-approve (CI/CD only)
export TF_CLI_ARGS_apply="-auto-approve"
```

## Sources

- [Terraform CLI Reference](https://developer.hashicorp.com/terraform/cli) — full command documentation

## Related Concepts

- [Core Workflow](./core-workflow.md)
- [HCL Syntax & Project Structure](./hcl-syntax-and-structure.md)
- [Best Practices](./best-practices.md)
