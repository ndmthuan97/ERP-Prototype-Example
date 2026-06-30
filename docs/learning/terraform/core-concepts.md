---
type: Concept Explanation
title: "Terraform Core Concepts"
description: "5 khái niệm cốt lõi: Provider, Resource, State, Module, Variables & Outputs"
tags: [terraform, concepts, hcl, provider, resource, state, module]
diataxis: explanation
timestamp: "2026-06-29T10:12:00+07:00"
---

# Terraform Core Concepts

## Định nghĩa

Terraform xây dựng trên **5 khái niệm cốt lõi**. Nắm 5 cái này = hiểu 80% cách Terraform hoạt động.

## Tại sao quan trọng

Mọi file `.tf` đều xoay quanh 5 khái niệm dưới đây. Không hiểu chúng = không viết được Terraform.

## Cách hoạt động

### 1. Provider — Adapter kết nối cloud

Provider là plugin cho phép Terraform giao tiếp với API của một platform cụ thể. Có **4000+ providers**: AWS, Azure, GCP, Kubernetes, Cloudflare, Datadog, GitHub...

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"     # Pin version to avoid breaking changes
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"   # Singapore
}
```

> [!TIP]
> **Luôn pin version** cho provider (`~> 5.0` cho phép `5.x` nhưng không cho `6.0`). Không pin = rủi ro breaking change khi provider release version mới.

---

### 2. Resource — Viên gạch xây hạ tầng

Mỗi resource đại diện cho **một tài nguyên thật** trên cloud (EC2 instance, S3 bucket, VPC...).

```hcl
resource "aws_instance" "web_server" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"

  tags = {
    Name = "Production-Web"
  }
}
```

**Cú pháp**: `resource "<PROVIDER>_<TYPE>" "<LOCAL_NAME>" { ... }`

- `aws_instance` → provider `aws`, resource type `instance`
- `web_server` → tên local để tham chiếu trong code

Bạn dùng tên đầy đủ `aws_instance.web_server` để tham chiếu resource này ở nơi khác trong config.

---

### 3. State — "Bộ nhớ" của Terraform

> [!CAUTION]
> **State là khái niệm QUAN TRỌNG NHẤT và cũng hay gây lỗi nhất.**

State file (`terraform.tfstate`) là file JSON lưu **bản đồ** giữa code của bạn và tài nguyên thực tế trên cloud.

```
Code (.tf)                State (.tfstate)              Cloud thật
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ aws_instance │ ←→  │ id: "i-0abc123..."   │ ←→  │ EC2 instance    │
│ "web_server" │     │ public_ip: "1.2.3.4" │     │ đang chạy       │
└─────────────┘     └──────────────────────┘     └─────────────────┘
```

**Khi `terraform plan` chạy:**
1. Đọc state file → biết tài nguyên nào đang tồn tại
2. So sánh code mới vs state → tính ra diff
3. Hiện preview: `+` tạo mới, `~` sửa, `-` xóa

**Quy tắc vàng về State:**

| ✅ Nên | ❌ Không bao giờ |
|---|---|
| Lưu state trên remote backend (S3, GCS) | Commit `terraform.tfstate` lên Git |
| Bật State Locking (tránh race condition) | Sửa state file bằng tay |
| Bật versioning trên bucket (rollback) | Để state trên máy local khi làm team |
| Encrypt state at rest (chứa secrets!) | Share state file qua Slack/email |

---

### 4. Module — "Hàm" tái sử dụng

Module = nhóm resources đóng gói thành đơn vị logic, tái sử dụng như function trong lập trình.

```hcl
# Gọi module từ Terraform Registry
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "production-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-southeast-1a", "ap-southeast-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
}
```

**Cấu trúc module tự viết:**

```
modules/
  web-server/
    ├── main.tf          # Resources
    ├── variables.tf     # Input parameters
    ├── outputs.tf       # Return values
    └── README.md
```

---

### 5. Variables & Outputs — Tham số vào/ra

**Variables** (input) — làm code linh hoạt, reusable:

```hcl
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}
```

**Outputs** (return) — xuất thông tin để sử dụng tiếp:

```hcl
output "server_ip" {
  description = "Public IP of the web server"
  value       = aws_instance.web_server.public_ip
}
```

**Data Sources** — đọc dữ liệu từ tài nguyên đã tồn tại (không do Terraform quản lý):

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-amd64-server-*"]
  }
}

# Reference: data.aws_ami.ubuntu.id
```

## Ví dụ thực tế

### Kết hợp 5 concepts trong một project

```
my-infra/
├── providers.tf      → Provider (aws ~> 5.0)
├── main.tf           → Resource (aws_instance, aws_security_group)
├── variables.tf      → Variables (region, instance_type, environment)
├── outputs.tf        → Outputs (server_ip, server_url)
├── backend.tf        → State (S3 remote backend)
└── modules/
    └── web-server/   → Module (reusable web server pattern)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|------------|----------------|
| `Error: No configuration files` | Chạy `terraform plan` ở sai thư mục | `cd` vào thư mục chứa `.tf` files |
| `Error: Failed to query provider` | Provider version không tương thích | Pin version trong `required_providers` |
| `Error acquiring the state lock` | Người khác đang chạy apply | Chờ xong hoặc `terraform force-unlock <ID>` |
| State drift (state ≠ cloud thật) | Ai đó sửa tay trên console | Chạy `terraform plan` để phát hiện → `apply` để đồng bộ |
| Circular dependency | Resource A phụ thuộc B, B phụ thuộc A | Tách thành 2 resource groups hoặc dùng `depends_on` |

## Related Concepts

- [IaC & Terraform Overview](./iac-and-terraform-overview.md)
- [Core Workflow](./core-workflow.md)
- [HCL Syntax & Project Structure](./hcl-syntax-and-structure.md)
