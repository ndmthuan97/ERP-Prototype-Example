---
type: Concept Explanation
title: "Terraform Core Workflow"
description: "Vòng đời init → plan → apply → destroy và tích hợp CI/CD"
tags: [terraform, workflow, cicd, plan, apply]
diataxis: explanation
timestamp: "2026-06-29T10:12:00+07:00"
---

# Terraform Core Workflow

## Định nghĩa

Mọi thao tác với Terraform đều xoay quanh **4 lệnh chính**: `init`, `plan`, `apply`, `destroy`. Nắm 4 lệnh này = sử dụng Terraform được ngay.

## Tại sao quan trọng

Workflow này là **vòng đời quản lý hạ tầng**. Sai thứ tự hoặc bỏ bước = rủi ro phá hạ tầng production.

## Cách hoạt động

### Lifecycle tổng quan

```
                    ┌─────────────┐
                    │  Write Code │
                    │   (.tf)     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
               ┌────│ terraform   │
               │    │    init     │──── Download providers, setup backend
               │    └──────┬──────┘
               │           │
               │    ┌──────▼──────┐
               │    │ terraform   │
      Iterate  │    │    plan     │──── Preview: +create ~update -destroy
               │    └──────┬──────┘
               │           │
               │           │ Review OK?
               │           │
               │    ┌──────▼──────┐
               │    │ terraform   │
               └────│   apply     │──── Execute changes on cloud
                    └──────┬──────┘
                           │
                           │ Tear down?
                           │
                    ┌──────▼──────┐
                    │ terraform   │
                    │  destroy    │──── Remove ALL managed resources
                    └─────────────┘
```

### Step 1: `terraform init`

Khởi tạo working directory — chạy **một lần** khi bắt đầu, hoặc khi thêm provider/module mới.

```bash
$ terraform init

Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.82.2...

Terraform has been successfully initialized!
```

**Những gì xảy ra:**
- Download provider plugins vào `.terraform/`
- Setup backend (local hoặc remote)
- Tạo `.terraform.lock.hcl` (lock file — **phải commit vào Git**)

---

### Step 2: `terraform plan`

So sánh **code** ↔ **state** → hiện preview thay đổi. **Không sửa gì trên cloud.**

```bash
$ terraform plan

Terraform will perform the following actions:

  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami           = "ami-0abcdef1234567890"
      + instance_type = "t3.micro"
      + tags          = {
          + "Name" = "Production-Web"
        }
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

**Ký hiệu:**
| Symbol | Meaning |
|--------|---------|
| `+` | Tạo mới resource |
| `~` | Sửa resource (in-place update) |
| `-/+` | Xóa rồi tạo lại (replace) |
| `-` | Xóa resource |

> [!TIP]
> Lưu plan ra file để apply chính xác cái đã review:
> ```bash
> terraform plan -out=plan.tfplan
> terraform apply plan.tfplan
> ```

---

### Step 3: `terraform apply`

Thực thi thay đổi lên cloud. Terraform hỏi xác nhận trước khi chạy (trừ khi dùng `-auto-approve`).

```bash
$ terraform apply

Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes

aws_instance.web: Creating...
aws_instance.web: Creation complete after 32s [id=i-0abc123def456]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:
  web_url = "http://1.2.3.4"
```

---

### Step 4: `terraform destroy`

Xóa **toàn bộ** resources trong state. Dùng khi tear down environment.

```bash
$ terraform destroy

Plan: 0 to add, 0 to change, 3 to destroy.

Do you really want to destroy all resources?
  Enter a value: yes
```

> [!WARNING]
> `terraform destroy` xóa MỌI THỨ được quản lý trong state file. Không có undo. Trong production, xóa từng resource cụ thể bằng cách comment code rồi `apply`.

---

### CI/CD Integration — Workflow cho team

```
Developer           GitHub              CI/CD Pipeline
   │                   │                      │
   │  Push branch      │                      │
   │──────────────────▶│                      │
   │                   │  Trigger pipeline    │
   │                   │─────────────────────▶│
   │                   │                      │
   │                   │     terraform init   │
   │                   │     terraform plan   │
   │                   │◀─────────────────────│
   │                   │                      │
   │  Create PR        │  Post plan as        │
   │──────────────────▶│  PR comment          │
   │                   │                      │
   │  Review & Approve │                      │
   │──────────────────▶│                      │
   │                   │  Merge → trigger     │
   │                   │─────────────────────▶│
   │                   │                      │
   │                   │    terraform apply   │
   │                   │◀─────────────────────│
```

**Quy tắc CI/CD:**
1. **Plan** chạy trên mọi PR → reviewer thấy chính xác thay đổi gì
2. **Apply** chỉ chạy sau merge vào main branch
3. Không ai chạy `terraform apply` từ laptop cá nhân

## Ví dụ thực tế

### Scenario: Thay đổi instance type

```hcl
# Sửa từ t3.micro → t3.small
resource "aws_instance" "web" {
  instance_type = "t3.small"  # was "t3.micro"
}
```

```bash
$ terraform plan
# aws_instance.web will be updated in-place
~ resource "aws_instance" "web" {
    ~ instance_type = "t3.micro" -> "t3.small"
  }

Plan: 0 to add, 1 to change, 0 to destroy.
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|------------|----------------|
| `terraform init` quên chạy | Thêm provider/module mới mà chưa init lại | Chạy `terraform init` |
| Apply không giống plan | Có người apply xen giữa plan → apply | Dùng `plan -out` + apply file |
| `Error: resource already exists` | Tài nguyên tạo trên console trước, state không biết | `terraform import` resource vào state |
| `-auto-approve` trong production | Bỏ qua review step | Chỉ dùng `-auto-approve` cho CI/CD pipeline đã qua review |

## Related Concepts

- [Core Concepts](./core-concepts.md)
- [HCL Syntax & Project Structure](./hcl-syntax-and-structure.md)
- [Best Practices](./best-practices.md)
