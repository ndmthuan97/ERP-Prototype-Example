---
type: Concept Explanation
title: "WIF on GCP"
description: "Đặc thù GCP: GitHub OIDC issuer, attribute condition siết bảo mật (repo/branch), direct WIF vs SA impersonation, principalSet scope, audit"
tags: [wif, gcp, github-oidc, attribute-condition, impersonation, security]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# WIF on GCP

## Định nghĩa

Những đặc thù GCP + GitHub quyết định độ an toàn của liên kết và cách siết chặt.

## Cách hoạt động

### 1. GitHub OIDC issuer

GCP tin token phát bởi:

```
https://token.actions.githubusercontent.com
```

Đây là issuer **cố định** của GitHub Actions. GCP verify chữ ký token với khoá công khai của issuer này → không cần GitHub biết gì về GCP.

### 2. Hai kiểu liên kết: Direct WIF vs SA Impersonation

| | **SA Impersonation** (dự án dùng) | **Direct resource access** |
|---|---|---|
| Cơ chế | principalSet → impersonate 1 SA → dùng quyền SA | Cấp role thẳng cho principalSet trên resource |
| Ưu | Gom quyền vào SA, dễ quản; tương thích tool cũ | Không cần SA trung gian |
| Nhược | Thêm một lớp SA | Phải cấp role cho principalSet ở từng resource |

> Dự án dùng **impersonation**: GitHub principalSet mượn danh tính **deployer SA** (đã gom sẵn mọi quyền deploy). Xem [IAM in This Project](../iam/in-this-project.md).

### 3. Attribute condition — các mức siết

Từ lỏng đến chặt:

```hcl
# Mức 1 (dự án): khoá theo repo — chặn mọi repo khác
attribute_condition = "assertion.repository == 'owner/repo'"

# Mức 2 (prod nên có): thêm branch — chỉ deploy từ main
attribute_condition = "assertion.repository == 'owner/repo' && assertion.ref == 'refs/heads/main'"

# Mức 3: theo environment / tag / actor... tuỳ nhu cầu
```

> [!WARNING]
> **Không bao giờ để provider thiếu `attribute_condition`.** Issuer GitHub là **chung cho mọi repo trên GitHub** → không có condition = bất kỳ repo nào cũng đổi token lấy quyền GCP của bạn. Tối thiểu khoá `repository`; production khoá thêm `ref`/branch để PR từ fork không deploy được.

### 4. principalSet scope — hẹp theo thuộc tính

```
principalSet://iam.googleapis.com/<pool>/attribute.repository/owner/repo
   → mọi run từ repo đó

principalSet://iam.googleapis.com/<pool>/attribute.ref/refs/heads/main
   → chỉ run trên branch main (nếu map attribute.ref)
```

Chọn thuộc tính hẹp nhất đủ dùng cho binding impersonation.

### 5. Audit

Mọi lần token được cấp + hành động của SA impersonated ghi vào **Cloud Audit Logs**, kèm `attribute.actor`/`repository` → truy vết được "run nào, ai, repo nào" đã deploy.

### 6. Bảo mật vận hành

| Nên | Không nên |
|---|---|
| Khoá `repository` (+ `ref` cho prod) | Để condition trống/lỏng |
| Dùng impersonation SA gom quyền | Tạo SA key JSON "cho chắc" |
| principalSet hẹp theo attribute | Cấp workloadIdentityUser cho cả pool |
| Siết branch để chặn fork PR | Cho mọi ref deploy production |

## Ví dụ thực tế

```
Pool: github-pool-dev
Provider: github-provider (issuer GitHub, condition repository == owner/repo)
Binding: principalSet .../attribute.repository/owner/repo
         có roles/iam.workloadIdentityUser trên deployer SA
→ deploy chỉ chạy được từ đúng repo; không key JSON nào tồn tại
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Repo/fork lạ deploy được | Condition thiếu hoặc chỉ `repository` (không chặn fork PR) | Thêm `assertion.ref == 'refs/heads/main'` |
| Auth OK nhưng thiếu quyền | principalSet chưa impersonate deployer / deployer thiếu role | Kiểm binding + role deployer |
| `invalid_target` / issuer sai | Sai `issuer_uri` | Dùng đúng issuer GitHub |

## Related Concepts

- [Core Concepts](./core-concepts.md) — pool, provider, condition, principalSet
- [WIF in This Project](./in-this-project.md) — cấu hình module
- [IAM in This Project](../iam/in-this-project.md) — deployer SA impersonated
