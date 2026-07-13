---
type: Reference
title: "Secret Manager — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: rotate không redeploy, project-wide access, hộp rỗng no versions, secret commit vào git, version cũ tồn đọng"
tags: [secret-manager, troubleshooting, pitfalls, security, gcp, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/secrets/main.tf"
---

# Secret Manager — Troubleshooting & Pitfalls

> Tra cứu nhanh khi service không đọc được secret, rotate không ăn, hoặc audit bảo mật.

## 1. Đọc secret

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Service crash: "permission denied on secret" | Runtime SA thiếu `secretAccessor` | Bind per-secret cho runtime SA ([in-this-project §3](./in-this-project.md)) |
| App lỗi "no versions" / "version not found" | Chỉ tạo hộp, quên `secret_version` | Tạo cả `secret_version` |
| Đọc `latest` ra giá trị cũ | Version mới bị DISABLED | Enable version mới nhất |

## 2. Rotation

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Rotate xong service vẫn giá trị cũ | Env resolve lúc start; chưa redeploy | Deploy revision mới / restart service |
| Lỡ destroy version còn dùng → service chết | Nhầm disable với destroy | Disable trước; destroy sau khi chắc chắn |

## 3. Pitfalls bảo mật

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Cấp `secretAccessor` project-wide | Backend đọc mọi secret trong project | Bind per-secret |
| Commit secret vào repo/tfvars public | Lộ vĩnh viễn trong git history | tfvars trong `.gitignore`; giá trị là `sensitive` var |
| Để bí mật trong plain env var | Hiện trong console/log/describe | Dùng `secret_key_ref` |
| Log giá trị secret khi debug | Lộ qua log | Không log; mask khi cần |

## 4. Chi phí / dọn dẹp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Hoá đơn secret tăng dần | Nhiều version cũ còn ENABLED | Disable/destroy version cũ sau rotate |

## 5. Debug nhanh

```bash
# Liệt kê secret
gcloud secrets list --project=<project_id>

# Xem các version của 1 secret
gcloud secrets versions list database-url-<env> --project=<project_id>

# Kiểm ai có accessor trên 1 secret (per-secret)
gcloud secrets get-iam-policy database-url-<env> --project=<project_id>

# Đọc giá trị version mới nhất (cẩn thận — lộ ra terminal)
gcloud secrets versions access latest --secret=jwt-secret-<env> --project=<project_id>
```

## Related Concepts

- [Secret Manager in This Project](./in-this-project.md) — 5 secret + per-secret accessor
- [Core Concepts](./core-concepts.md) — secret vs version, rotation
- [IAM Troubleshooting](../iam/troubleshooting-and-pitfalls.md) — lỗi quyền
