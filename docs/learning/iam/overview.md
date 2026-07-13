---
type: Learning Note
title: "IAM & Service Accounts Overview"
description: "IAM là gì, mô hình Who-What-Which, danh tính người vs máy (service account), nguyên tắc least privilege và blast radius"
tags: [learning, iam, service-account, security, least-privilege, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# IAM & Service Accounts Overview

## Summary

**IAM** trả lời đúng một câu: **"Ai (member) được làm gì (role) trên tài nguyên nào (resource)?"**

```
        WHO                WHAT                    WHICH
   ┌───────────┐      ┌──────────────┐      ┌──────────────────┐
   │  Member    │──────│    Role      │──────│    Resource      │
   │ (danh tính)│ được │ (bó quyền)   │ trên │ (project/secret/ │
   │            │      │              │      │  service/...)    │
   └───────────┘      └──────────────┘      └──────────────────┘
   vd: erp-backend-dev  roles/cloudsql.client   project / 1 Cloud SQL
```

Điểm mấu chốt trên cloud: **"ai" của một service không phải con người** mà là một **Service Account (SA)** — danh tính dành cho máy.

## Key Concepts

### Danh tính người vs danh tính máy

| | Người (`user:`) | Máy (`serviceAccount:`) |
|---|---|---|
| Đăng nhập | Email + mật khẩu + MFA | Không đăng nhập — được gán cho service |
| Ví dụ | `user:dev@company.com` | `erp-backend-dev@project.iam.gserviceaccount.com` |
| Dùng cho | Người vận hành, developer | Cloud Run, Cloud Build, CI/CD |

> [!IMPORTANT]
> Cloud Run **chạy dưới danh tính một SA**. SA đó quyết định service đọc được secret nào, gọi được DB/Pub/Sub nào. Chọn SA + role cho SA = quyết định "bán kính nổ" (blast radius) khi service bị chiếm.

### Least Privilege — nguyên tắc trung tâm

Cấp **đúng và đủ** quyền cần thiết, không hơn. Mỗi quyền thừa = một cửa mở thêm cho kẻ tấn công.

```
❌ Over-privilege:  backend SA có roles/editor (gần như admin cả project)
                    → lộ 1 service = mất cả project
✅ Least privilege: backend SA chỉ có cloudsql.client + pubsub.* + secretAccessor
                    (trên đúng 5 secret) → lộ service = thiệt hại giới hạn
```

### Blast radius — vì sao tách nhiều SA

Gộp mọi service vào 1 SA quyền cao = 1 điểm lộ làm sập tất cả. Tách theo vai trò → cô lập thiệt hại:

```
erp-backend-dev   → chạm DB/Pub/Sub/secret (runtime backend + gateway)
erp-frontend-dev  → KHÔNG quyền đặc biệt (chỉ phục vụ HTTP)
erp-deployer-dev  → quyền deploy (CI/CD) — cao nhất, nên keyless (WIF)
```

### Cross-cloud — mental model giống nhau

| | GCP | AWS | Azure |
|---|---|---|---|
| Danh tính máy | **Service Account** | IAM Role (assumed) | Managed Identity / SP |
| Bó quyền | Role (predefined) | Policy | Role definition |
| Gán quyền | IAM binding | Attach policy | Role assignment |
| Phạm vi | Org/Folder/Project/Resource | Account/Resource | Mgmt group/Sub/RG/Resource |

### Vị trí trong kiến trúc ERP

IAM là **lớp danh tính nền tảng** — mọi service khác gắn vào nó:

```
Cloud Run ── chạy dưới ──▶ Service Account ── có ──▶ Roles ── trên ──▶ Cloud SQL / Pub/Sub / Secret
GitHub CI ── impersonate ─▶ deployer SA (qua WIF, keyless)
```

## Practical Application

Khi thiết kế quyền cho một service mới, hỏi theo thứ tự:
1. Service này cần **chạm** những tài nguyên nào? (DB? secret? topic?)
2. Với mỗi cái, cần **role tối thiểu** nào? (`client` chứ không `admin`)
3. Có thể bind ở cấp **resource** thay vì **project** không? (hẹp hơn = an toàn hơn)
4. Danh tính CI có cần **key tĩnh** không? → **Không**, dùng WIF.

## References

- [Google Cloud IAM Docs](https://cloud.google.com/iam/docs/overview) — tài liệu chính thức
- [Service Accounts](https://cloud.google.com/iam/docs/service-account-overview) — danh tính máy
- [IAM Best Practices](https://cloud.google.com/iam/docs/using-iam-securely) — dùng IAM an toàn

## Related Concepts

- [Core Concepts](./core-concepts.md) — member, role, binding, actAs
- [IAM on GCP](./on-gcp.md) — resource hierarchy, service agents
- [IAM in This Project](./in-this-project.md) — 3 service account
