---
type: Reference
title: "HCL Syntax & Project Structure"
description: "Cú pháp HCL, quy ước đặt tên file, và cấu trúc project Terraform chuẩn"
tags: [terraform, hcl, syntax, project-structure, reference]
diataxis: reference
timestamp: "2026-06-29T10:12:00+07:00"
---

# HCL Syntax & Project Structure

## Quick Reference

### Cú pháp HCL cơ bản

Terraform dùng **HashiCorp Configuration Language (HCL)** — ngôn ngữ declarative, dễ đọc hơn JSON/YAML nhưng mạnh mẽ hơn.

| Element | Syntax | Ví dụ |
|---------|--------|-------|
| Block | `type "label" { ... }` | `resource "aws_instance" "web" { ... }` |
| Argument | `key = value` | `instance_type = "t3.micro"` |
| String | `"..."` | `"ap-southeast-1"` |
| Number | literal | `8080` |
| Boolean | `true` / `false` | `associate_public_ip = true` |
| List | `[...]` | `["us-east-1a", "us-east-1b"]` |
| Map | `{ key = value }` | `{ Name = "web", Env = "prod" }` |
| String interpolation | `"${...}"` | `"Hello ${var.name}"` |
| Reference | `type.name.attribute` | `aws_instance.web.public_ip` |
| Comment (single) | `#` hoặc `//` | `# This is a comment` |
| Comment (multi) | `/* ... */` | `/* multi-line */` |

### Block types thường gặp

```hcl
# Provider configuration
provider "aws" {
  region = "ap-southeast-1"
}

# Resource definition
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"
}

# Variable declaration
variable "region" {
  type    = string
  default = "ap-southeast-1"
}

# Output value
output "bucket_arn" {
  value = aws_s3_bucket.data.arn
}

# Data source (read-only)
data "aws_caller_identity" "current" {}

# Module call
module "vpc" {
  source = "./modules/vpc"
  cidr   = "10.0.0.0/16"
}

# Local values (computed constants)
locals {
  common_tags = {
    Project   = "my-app"
    ManagedBy = "terraform"
  }
}

# Terraform settings
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

### Variable types

| Type | Syntax | Ví dụ |
|------|--------|-------|
| `string` | `type = string` | `"hello"` |
| `number` | `type = number` | `42` |
| `bool` | `type = bool` | `true` |
| `list(T)` | `type = list(string)` | `["a", "b"]` |
| `map(T)` | `type = map(string)` | `{ key = "val" }` |
| `set(T)` | `type = set(number)` | `[1, 2, 3]` (unique) |
| `object({})` | `type = object({ name = string })` | `{ name = "web" }` |
| `tuple([])` | `type = tuple([string, number])` | `["web", 3]` |

### Expressions & Functions hay dùng

```hcl
# Conditional
instance_type = var.env == "prod" ? "t3.large" : "t3.micro"

# For expression
upper_names = [for name in var.names : upper(name)]

# Count (create N copies)
resource "aws_instance" "web" {
  count         = 3
  instance_type = "t3.micro"
  tags = { Name = "web-${count.index}" }
}

# for_each (create from map/set)
resource "aws_iam_user" "users" {
  for_each = toset(["alice", "bob", "charlie"])
  name     = each.value
}

# Dynamic block
dynamic "ingress" {
  for_each = var.allowed_ports
  content {
    from_port   = ingress.value
    to_port     = ingress.value
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Common functions
length(var.list)                    # List length
lookup(var.map, "key", "default")   # Map lookup with default
join(",", var.list)                 # Join list to string
split(",", var.csv_string)         # Split string to list
file("${path.module}/script.sh")   # Read file content
templatefile("tpl.sh", { port = 8080 })  # Template rendering
```

---

## Cấu trúc Project chuẩn

### Project đơn giản

```
my-infra/
├── main.tf              # Resources chính
├── variables.tf         # Input variable declarations
├── outputs.tf           # Output value declarations
├── providers.tf         # Provider + terraform block
├── terraform.tfvars     # Variable values (cho env hiện tại)
├── backend.tf           # Remote state configuration
├── .terraform.lock.hcl  # Lock file ← COMMIT vào Git
├── .terraform/          # Provider cache ← GITIGNORE
└── terraform.tfstate    # State file ← GITIGNORE (nếu local)
```

### Project multi-environment (production-grade)

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars     # Values cho dev
│   │   └── backend.tf           # S3 key: "dev/terraform.tfstate"
│   ├── staging/
│   │   └── ...
│   └── prod/
│       └── ...
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   │   └── ...
│   └── database/
│       └── ...
└── .terraform.lock.hcl
```

### Quy ước file

| File | Chứa gì | Bắt buộc? |
|------|---------|-----------|
| `main.tf` | Resources chính | ✅ |
| `variables.tf` | Khai báo input variables | ✅ |
| `outputs.tf` | Khai báo output values | ✅ |
| `providers.tf` | Provider configuration + `terraform {}` block | ✅ |
| `terraform.tfvars` | Gán giá trị cho variables | Recommended |
| `backend.tf` | Remote state backend config | Recommended |
| `locals.tf` | Local values (computed) | Optional |
| `data.tf` | Data sources | Optional |
| `versions.tf` | Version constraints (alt. to providers.tf) | Optional |

### `.gitignore` chuẩn cho Terraform

```gitignore
# Local .terraform directories
**/.terraform/*

# .tfstate files (use remote backend!)
*.tfstate
*.tfstate.*

# Crash log files
crash.log
crash.*.log

# Sensitive variable files
*.tfvars
!example.tfvars

# Override files
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration
.terraformrc
terraform.rc
```

> [!IMPORTANT]
> **LUÔN commit** `.terraform.lock.hcl` — đảm bảo mọi người dùng cùng provider version.
> **KHÔNG BAO GIỜ commit** `.terraform/` và `*.tfstate` — chứa secrets và cache.

## Sources

- [HashiCorp Style Guide](https://developer.hashicorp.com/terraform/language/style) — official style conventions
- [HCL Syntax Spec](https://developer.hashicorp.com/terraform/language/syntax/configuration) — full syntax reference

## Related Concepts

- [Core Concepts](./core-concepts.md)
- [Core Workflow](./core-workflow.md)
- [Best Practices](./best-practices.md)
