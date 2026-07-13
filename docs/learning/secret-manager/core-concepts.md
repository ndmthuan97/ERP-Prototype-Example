---
type: Concept Explanation
title: "Secret Manager Core Concepts"
description: "Building blocks: Secret (hộp) vs Version (giá trị), Replication, Accessor binding, Rotation, disable/destroy version, secret_key_ref"
tags: [secret-manager, secret, version, replication, rotation, accessor]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Secret Manager Core Concepts

## Định nghĩa

Secret Manager xây trên vài khái niệm cốt lõi. Nắm chúng = lưu, đọc, và xoay vòng bí mật đúng cách.

## Tại sao quan trọng

Nhầm "secret" với "version" → tạo hộp rỗng, app đọc lỗi. Không hiểu accessor → cấp quyền quá rộng. Không hiểu version → rotate xong service vẫn dùng giá trị cũ.

## Cách hoạt động

### 1. Secret vs Version — mấu chốt

- **Secret** = "cái hộp" có **tên** (`database-url-dev`). Bản thân nó **không** chứa giá trị.
- **Secret Version** = **giá trị thực** nằm ở version. Mỗi lần đổi giá trị = version mới.

```
Secret: database-url-dev  (cái hộp)
 ├── version 1  "postgresql://...old..."   [DISABLED]
 ├── version 2  "postgresql://...mid..."   [ENABLED]
 └── version 3  "postgresql://...new..."   [ENABLED]  ← "latest"
```

> [!IMPORTANT]
> Luôn tạo **cả hai**: `secret` (hộp) + `secret_version` (giá trị). Tạo hộp rỗng → app đọc `latest` sẽ lỗi "no versions".

### 2. Đọc version: `latest` hay số cụ thể

| Tham chiếu | Nghĩa |
|---|---|
| `latest` | Luôn lấy version mới nhất (ENABLED) — tiện, tự nhận giá trị mới |
| `5` (số) | Ghim đúng version 5 — ổn định, nhưng rotate không tự nhận |

Dự án dùng `version = "latest"` → tạo version mới là service (sau khi restart) nhận giá trị mới.

### 3. Replication — bí mật lưu ở đâu

| Loại | Nghĩa |
|---|---|
| **Automatic** (`auto {}`) | Google tự nhân bản đa vùng — đơn giản, chọn mặc định (dự án dùng) |
| **User-managed** | Bạn chỉ định region cụ thể — khi có yêu cầu data residency |

### 4. Accessor binding — ai được đọc

`roles/secretmanager.secretAccessor` cho phép **đọc giá trị**. Bind ở đâu quyết định phạm vi:

```
❌ project-wide:  SA đọc MỌI secret trong project
✅ per-secret:    SA đọc ĐÚNG secret được bind
```

> [!IMPORTANT]
> **Per-secret accessor** là cách least-privilege đúng. Dự án bind `secretAccessor` cho backend SA trên **từng** trong 5 secret ERP, không cấp project-wide. Xem [in-this-project](./in-this-project.md) + [IAM on GCP §4](../iam/on-gcp.md).

### 5. Rotation — xoay vòng bí mật

Đổi giá trị định kỳ (hoặc khi nghi lộ) = tạo **version mới**, rồi vô hiệu version cũ. Vì app đọc `latest`, rotate **không cần sửa code**.

```
Rotate JWT key:
  1. tạo version mới với key mới
  2. redeploy/restart service để nạp giá trị mới (xem cảnh báo dưới)
  3. disable version cũ sau khi chắc không còn ai dùng
```

> [!WARNING]
> **Rotate mà không redeploy = vô ích.** Cloud Run đọc secret lúc **khởi động** và giữ trong RAM của revision. Version mới **không** tự chảy vào revision đang chạy — phải deploy revision mới (hoặc restart) để nạp lại.

### 6. Disable vs Destroy version

| Hành động | Nghĩa | Khôi phục |
|---|---|---|
| **Disable** | Tạm tắt version (không đọc được) | Có thể enable lại |
| **Destroy** | Xoá **vĩnh viễn** giá trị của version | Không |

Rotate an toàn: **disable** version cũ trước (dễ rollback), chỉ **destroy** khi chắc chắn.

## Ví dụ thực tế

```
database-url-dev
 ├── secret (hộp)                         → google_secret_manager_secret
 ├── version (giá trị từ module.database)  → google_secret_manager_secret_version
 └── IAM: backend SA có secretAccessor     → google_secret_manager_secret_iam_member (per-secret)
Cloud Run env DATABASE_URL → secret_key_ref(database-url-dev, latest)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| App đọc secret lỗi "no versions" | Chỉ tạo hộp, quên version | Tạo cả `secret_version` |
| Rotate xong service vẫn giá trị cũ | Không redeploy sau khi tạo version | Deploy revision mới / restart |
| SA đọc được secret không nên | Accessor cấp project-wide | Bind per-secret |
| Lỡ destroy version còn dùng | Nhầm disable với destroy | Disable trước; destroy sau khi chắc |

## Related Concepts

- [Overview](./overview.md) — vì sao dùng Secret Manager
- [Secret Manager on GCP](./on-gcp.md) — tích hợp Cloud Run, CMEK
- [Secret Manager in This Project](./in-this-project.md) — 5 secret + per-secret accessor
