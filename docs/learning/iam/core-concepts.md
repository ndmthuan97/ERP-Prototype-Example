---
type: Concept Explanation
title: "IAM Core Concepts"
description: "Building blocks: Member, Role (primitive/predefined/custom), Binding, Policy, Service Account, key, impersonation (actAs)"
tags: [iam, member, role, binding, policy, service-account, impersonation]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# IAM Core Concepts

## Định nghĩa

IAM xây trên vài khái niệm cốt lõi. Nắm chúng = đọc/viết được mọi phân quyền GCP.

## Tại sao quan trọng

Không hiểu member/role/binding = không debug được `403 Forbidden`, không biết vì sao deploy fail "cannot actAs", hay vì sao 1 SA đọc được secret không nên đọc.

## Cách hoạt động

### 1. Member — "ai"

Chủ thể được cấp quyền. Các loại member:

| Loại | Ví dụ | Dùng cho |
|---|---|---|
| `user:` | `user:dev@company.com` | Con người |
| `serviceAccount:` | `erp-backend-dev@...gserviceaccount.com` | Service/máy |
| `group:` | `group:eng@company.com` | Nhóm người |
| `allUsers` | (bất kỳ ai trên internet) | Service công khai |
| `allAuthenticatedUsers` | Bất kỳ ai đã đăng nhập Google | Ít dùng |
| `principalSet://` | Tập danh tính liên kết (WIF) | GitHub Actions → GCP |

### 2. Role — "được làm gì"

Một **role** là bó nhiều permission. Ba loại:

| Loại role | Ví dụ | Khuyến nghị |
|---|---|---|
| **Primitive** | `roles/owner`, `roles/editor`, `roles/viewer` | **Tránh** — quá rộng |
| **Predefined** | `roles/cloudsql.client`, `roles/run.invoker` | **Dùng** — Google định nghĩa sẵn, vừa đủ |
| **Custom** | Bạn tự gom permission | Chỉ khi predefined không khớp (khó audit) |

> [!IMPORTANT]
> Ưu tiên **predefined role**. `roles/editor` (primitive) cho gần như toàn quyền project — dùng nó cho 1 service là bom nổ chậm. Predefined như `roles/cloudsql.client` chỉ mở đúng "kết nối Cloud SQL".

### 3. Binding — gán (member → role) trên resource

Một **binding** = phép gán `(member, role)` trên một resource cụ thể.

```
binding:
  resource: project my-erp     (hoặc: 1 secret cụ thể)
  role:     roles/cloudsql.client
  member:   serviceAccount:erp-backend-dev@...
```

Trong Terraform, binding có nhiều "hình dạng":

| Resource TF | Ý nghĩa | Rủi ro |
|---|---|---|
| `google_project_iam_member` | Thêm 1 member vào 1 role ở cấp project (non-authoritative) | An toàn — không xoá binding khác |
| `google_project_iam_binding` | Đặt **toàn bộ** member cho 1 role (authoritative) | **Nguy hiểm** — ghi đè, có thể khoá người khác |
| `google_<resource>_iam_member` | Binding ở cấp **resource** (1 secret, 1 service) | An toàn + hẹp (least privilege) |

> [!TIP]
> Dùng `..._iam_member` (số ít, non-authoritative). Tránh `..._iam_binding` (số ít nhưng authoritative — ghi đè toàn bộ) trừ khi thực sự muốn kiểm soát tuyệt đối danh sách.

### 4. Policy — tập hợp binding

**IAM Policy** của một resource = tất cả binding gắn trên nó. "Ai được làm gì ở đây" = đọc policy của resource đó.

### 5. Service Account — danh tính máy (+ key)

SA định danh bằng **email**. Nó vừa là **member** (được cấp role để *dùng* tài nguyên) vừa là **resource** (người khác được cấp quyền *trên* nó — vd để impersonate).

**SA key (JSON)**: file chứa private key để xác thực như SA đó ngoài GCP.

> [!WARNING]
> **SA key là bí mật dài hạn — nguồn rò rỉ số 1.** Key lộ = toàn quyền của SA đó, không tự hết hạn. Tránh tạo key; thay bằng **Workload Identity Federation** (token ngắn hạn). Xem [WIF](../workload-identity-federation/index.md).

### 6. Impersonation & `actAs`

Một danh tính "đóng vai" (impersonate) SA khác để mượn quyền của nó. Điều khiển bởi `roles/iam.serviceAccountUser` (thường gọi là quyền **`actAs`**).

```
deployer SA ──(actAs)──▶ runtime SA (backend/frontend)
   "deploy service để nó CHẠY dưới danh tính runtime SA"
GitHub Actions ──(workloadIdentityUser, qua WIF)──▶ deployer SA
```

> [!IMPORTANT]
> Deploy Cloud Run cần `actAs` runtime SA: pipeline (deployer) tạo service **chạy dưới** SA khác → phải được phép "đóng vai" SA đó. Thiếu → deploy fail "cannot act as service account".

## Ví dụ thực tế

```
erp-backend-dev  (member)  ── roles/cloudsql.client, pubsub.*, run.invoker (project)
                            ── roles/secretmanager.secretAccessor (chỉ trên 5 secret)
erp-deployer-dev (member)  ── roles/run.admin, artifactregistry.writer,
                               iam.serviceAccountUser (actAs runtime), clouddeploy.*
erp-deployer-dev (resource)── GitHub principalSet có roles/iam.workloadIdentityUser (impersonate)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `403 PERMISSION_DENIED` khi gọi API | Member thiếu role cần thiết | Cấp đúng predefined role |
| Deploy fail "cannot act as service account" | Thiếu `iam.serviceAccountUser` (actAs) | Cấp actAs runtime SA cho deployer |
| SA đọc được secret không nên đọc | Cấp `secretAccessor` cấp **project** | Bind per-secret thay vì project-wide |
| `iam_binding` khoá mất người khác | Dùng authoritative binding ghi đè | Chuyển sang `iam_member` |
| Key JSON lộ | Tạo & lưu key tĩnh | Xoá key; dùng WIF |

## Related Concepts

- [Overview](./overview.md) — Who-What-Which, least privilege
- [IAM on GCP](./on-gcp.md) — resource hierarchy, service agents, conditions
- [IAM in This Project](./in-this-project.md) — 3 SA thực tế
