---
type: Concept Explanation
title: "IAM on GCP"
description: "Đặc thù GCP: resource hierarchy (org/folder/project/resource), inheritance, Google-managed service agents, IAM Conditions, scope binding hẹp"
tags: [iam, gcp, resource-hierarchy, service-agent, iam-conditions]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# IAM on GCP

## Định nghĩa

Những đặc thù GCP quyết định quyền được **kế thừa** ở đâu và ai là những SA "vô hình" Google tự tạo.

## Cách hoạt động

### 1. Resource Hierarchy — quyền chảy từ trên xuống

GCP tổ chức tài nguyên theo cây; IAM policy **kế thừa xuống dưới**.

```
Organization
   └── Folder
        └── Project              ← đa số binding ở đây
             └── Resource        ← binding hẹp nhất (1 secret, 1 service)
                (Cloud SQL, Secret, Cloud Run service, topic...)
```

| Cấp | Binding ở đây nghĩa là | Ví dụ dự án |
|---|---|---|
| Organization/Folder | Áp cho mọi project bên dưới | (không dùng trực tiếp) |
| **Project** | Áp cho mọi resource trong project | `roles/cloudsql.client` cho backend SA |
| **Resource** | Chỉ áp cho đúng resource đó | `secretAccessor` trên **1 secret** |

> [!IMPORTANT]
> **Quyền là hợp (union) của mọi cấp kế thừa.** Cấp ở project = rộng; cấp ở resource = hẹp. Least privilege ⇒ ưu tiên cấp thấp nhất đủ dùng. Dự án cố ý **không** cấp `secretAccessor` ở project mà cấp ở từng secret — xem [in-this-project](./in-this-project.md).

### 2. Google-managed Service Agents — SA "vô hình"

Nhiều dịch vụ GCP có **service agent** riêng do Google tạo tự động, dạng:

```
service-<PROJECT_NUMBER>@gcp-sa-<service>.iam.gserviceaccount.com
```

Chúng thực hiện hành động **thay mặt dịch vụ** (không phải app của bạn). Ví dụ trong dự án: agent Pub/Sub cần quyền để **chuyển message chết** (dead-letter).

> [!WARNING]
> Một số tính năng **fail âm thầm** nếu service agent thiếu quyền. Ví dụ dead-lettering của Pub/Sub cần agent có `publisher` trên dead-letter topic + `subscriber` trên source subscription — thiếu là message chết không được chuyển. Xem [Pub/Sub in This Project](../pubsub/in-this-project.md).

### 3. IAM Conditions — binding có điều kiện

Gắn **điều kiện** (thời gian, tên resource, tag...) vào binding → quyền chỉ hiệu lực khi điều kiện đúng.

```
Cho phép truy cập secret CHỈ KHI resource.name khớp "projects/*/secrets/database-*"
```

Dùng cho phân quyền tinh vi. Attribute condition của WIF (`assertion.repository == '...'`) là họ hàng ý tưởng này — xem [WIF](../workload-identity-federation/index.md).

### 4. Scope binding — hẹp hơn = an toàn hơn

Cùng một role có thể bind ở nhiều cấp; chọn cấp hẹp nhất:

| Cách | Ai đọc được | Least privilege |
|---|---|---|
| `secretAccessor` ở **project** | Mọi secret trong project | ❌ rộng |
| `secretAccessor` ở **từng secret** | Chỉ secret được bind | ✅ hẹp |

### 5. Predefined roles hay dùng (tra nhanh)

| Role | Cho phép |
|---|---|
| `roles/run.invoker` | Gọi (invoke) Cloud Run service |
| `roles/run.admin` | Tạo/sửa/xoá Cloud Run service |
| `roles/cloudsql.client` | Kết nối Cloud SQL instance |
| `roles/pubsub.publisher` / `.subscriber` | Publish / consume Pub/Sub |
| `roles/secretmanager.secretAccessor` | Đọc giá trị secret |
| `roles/artifactregistry.writer` | Push image lên Artifact Registry |
| `roles/iam.serviceAccountUser` | `actAs` một SA khác |
| `roles/iam.workloadIdentityUser` | Danh tính liên kết (WIF) impersonate SA |

### 6. Best practices (áp dụng trong dự án)

- Dùng **predefined** role, tránh primitive (`editor`/`owner`).
- Bind cấp **resource** khi có thể (secret, service).
- **Không** tạo SA key tĩnh → dùng WIF cho CI/CD.
- Tách SA theo **vai trò** để giảm blast radius.
- `..._iam_member` (non-authoritative) thay vì `..._iam_binding` (ghi đè).

## Ví dụ thực tế

```
Project my-erp
 ├── backend SA: cloudsql.client, pubsub.*, run.invoker         (cấp project)
 ├── backend SA: secretAccessor                                  (cấp RESOURCE: 5 secret)
 ├── deployer SA: run.admin, artifactregistry.writer, actAs...  (cấp project)
 └── pubsub service agent: publisher/subscriber cho dead-letter  (cấp resource)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Tính năng managed fail âm thầm | Service agent thiếu quyền | Cấp role cho `service-<num>@gcp-sa-*` |
| Quyền rộng ngoài ý muốn | Bind ở cấp project/folder bị kế thừa xuống | Chuyển binding xuống cấp resource |
| Khó audit "ai đọc được gì" | Trộn nhiều cấp + custom role | Chuẩn hoá predefined + cấp resource |

## Related Concepts

- [Core Concepts](./core-concepts.md) — member, role, binding, actAs
- [IAM in This Project](./in-this-project.md) — 3 SA + scope binding
- [Workload Identity Federation](../workload-identity-federation/index.md) — keyless CI
