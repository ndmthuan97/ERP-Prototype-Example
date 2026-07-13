---
type: Learning Note
title: "Secret Manager Overview"
description: "Secret management là gì, tại sao không nhét bí mật vào env/config/repo, vấn đề secret sprawl, so sánh với Vault / env vars"
tags: [learning, secret-manager, security, secrets, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Secret Manager Overview

## Summary

**Secret Manager** = "két sắt" managed để lưu **bí mật** (mật khẩu DB, JWT signing key, API token) và cấp quyền đọc **đúng danh tính, đúng bí mật, có audit**. App kéo giá trị lúc runtime thay vì nhúng vào code/config.

```
   ❌ Bí mật rải rác                    ✅ Secret Manager
  ┌────────────────────┐             ┌──────────────────────┐
  │ .env commit vào git │             │  Secret Manager       │
  │ hardcode trong image│    ──▶      │  • 1 nơi tập trung    │
  │ dán trong CI config │             │  • IAM-gated đọc      │
  │ Slack "pass DB đây" │             │  • version + audit    │
  └────────────────────┘             │  • rotate không sửa   │
    → lộ là vĩnh viễn                 │    code               │
                                      └──────────────────────┘
```

## Key Concepts

### Vì sao KHÔNG để bí mật trong env/config/repo?

| Nơi cất sai | Vấn đề |
|---|---|
| Commit `.env` vào git | Lộ **vĩnh viễn** trong lịch sử git, dù đã xoá sau |
| Hardcode trong Docker image | Ai pull được image = đọc được bí mật |
| Env var plain trên Cloud Run | Hiện trong console/logs/describe; ai xem config là thấy |
| Dán trong CI/CD config | Lộ theo pipeline, khó xoay vòng |

> [!IMPORTANT]
> Bí mật trong **plain env var** không phải "an toàn vừa đủ" — nó hiện trong mô tả service, log deploy, và bất kỳ ai có quyền xem config. Secret Manager tách **quyền chạy service** khỏi **quyền đọc bí mật**.

### Secret sprawl — vấn đề khi hệ lớn lên

Không có nơi tập trung, bí mật **lan ra** (sprawl): mỗi service một bản copy, không ai biết cái nào mới, rotate một cái phải sửa mười chỗ. Secret Manager cho **một nguồn** + **versioning** → rotate một chỗ.

### So sánh lựa chọn

| | Env var plain | **Secret Manager** | HashiCorp Vault |
|---|---|---|---|
| Managed | — | ✅ Google lo | Tự vận hành (hoặc HCP) |
| IAM tích hợp GCP | — | ✅ Sâu | Cần cấu hình |
| Versioning + audit | ❌ | ✅ | ✅ |
| Dynamic secrets (DB cred tạm) | ❌ | ❌ | ✅ |
| Độ phức tạp | Thấp nhất | **Thấp** | Cao |

Dự án ở quy mô vừa, đã ở GCP → **Secret Manager** là nấc đúng (chưa cần Vault + dynamic secrets).

### Cross-cloud

| GCP | AWS | Azure |
|---|---|---|
| **Secret Manager** | Secrets Manager / SSM Parameter Store | Key Vault |

### Vị trí trong kiến trúc ERP

```
Cloud SQL ─(connection_url)─┐
var.jwt_secret ─────────────┤
Upstash Redis ──────────────┴─▶ Secret Manager (5 secret) ─(secret_key_ref)─▶ Cloud Run env
                                        ▲ IAM: backend SA có secretAccessor (per-secret)
```

## Practical Application

Cất vào Secret Manager mọi thứ **nếu lộ sẽ gây hại**: mật khẩu DB, JWT/HMAC key, API token bên thứ ba, private key. Cấu hình **không nhạy cảm** (log level, feature flag, URL public) thì để env plain là đủ.

## References

- [Secret Manager Docs](https://cloud.google.com/secret-manager/docs) — tài liệu chính thức
- [Cloud Run + secrets](https://cloud.google.com/run/docs/configuring/services/secrets) — inject secret vào service
- [Secret rotation](https://cloud.google.com/secret-manager/docs/secret-rotation) — xoay vòng

## Related Concepts

- [Core Concepts](./core-concepts.md) — secret vs version, replication, rotation
- [Secret Manager on GCP](./on-gcp.md) — tích hợp Cloud Run
- [Secret Manager in This Project](./in-this-project.md) — 5 secret thực tế
