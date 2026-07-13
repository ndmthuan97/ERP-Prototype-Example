---
type: Learning Note
title: "Workload Identity Federation Overview"
description: "Vấn đề SA key tĩnh, keyless authentication là gì, OIDC federation, tại sao WIF thay thế key JSON cho CI/CD"
tags: [learning, workload-identity-federation, wif, oidc, keyless, ci-cd, security, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Workload Identity Federation Overview

## Summary

**WIF** trả lời một câu: *"Làm sao GitHub Actions deploy lên GCP mà **không** phải lưu key JSON của service account?"* Câu trả lời: GitHub tự phát hành **token OIDC** ngắn hạn chứng minh "job này chạy từ repo X"; GCP tin token đó và cho phép **đóng vai (impersonate)** deployer SA. Không có bí mật dài hạn nào phải cất.

```
   ❌ Cách cũ (SA key)                 ✅ WIF (keyless)
  ┌──────────────────┐              ┌──────────────────────┐
  │ tạo key JSON      │              │ GitHub phát token     │
  │ lưu GitHub Secret │    ──▶       │ OIDC (sống vài phút)  │
  │ (bí mật dài hạn)  │              │ GCP verify → cấp      │
  │ lộ = toàn quyền   │              │ token deployer tạm    │
  │ quên rotate       │              │ hết hạn tự động       │
  └──────────────────┘              └──────────────────────┘
```

## Key Concepts

### Vấn đề của SA key tĩnh

| Nhược điểm key JSON | Vì sao nguy hiểm |
|---|---|
| Bí mật **dài hạn** | Không tự hết hạn; lộ là toàn quyền SA cho tới khi ai đó phát hiện |
| Phải **rotate thủ công** | Ai cũng quên → key sống nhiều năm |
| Nằm ngoài GCP (GitHub Secret) | Bề mặt tấn công ngoài tầm kiểm soát GCP |
| Copy dễ dàng | Một lần lộ (log, screenshot, commit nhầm) là mất |

> [!IMPORTANT]
> SA key là **nguồn rò rỉ số 1** trong CI/CD. WIF loại bỏ hoàn toàn: không key nào tồn tại để mà lộ.

### Keyless authentication — ý tưởng

Thay vì "cầm chìa khoá vĩnh viễn", workload **chứng minh danh tính tại thời điểm chạy** bằng một token ngắn hạn do nhà cung cấp đáng tin (GitHub) ký. GCP verify chữ ký + điều kiện → cấp quyền tạm.

### Analogy: hộ chiếu + visa có điều kiện

```
GitHub  = cơ quan cấp HỘ CHIẾU (token OIDC: "tôi là job của repo owner/repo")
GCP     = cấp VISA CÓ ĐIỀU KIỆN (chỉ hộ chiếu ghi đúng repo mới được vào
          và mượn danh tính deployer)
```

Hộ chiếu **hết hạn nhanh** (vài phút), chỉ dùng được cho đúng chuyến đi (workflow run) đó.

### OIDC federation — nền tảng

**OIDC** (OpenID Connect) là chuẩn để một bên phát hành **token có chữ ký** khẳng định danh tính. WIF **liên kết (federate)** danh tính OIDC ngoài (GitHub) với IAM của GCP — GCP "tin" nhà phát hành mà không cần GitHub biết gì về key GCP.

### Cross-cloud / cross-provider

| Nhu cầu | GCP | AWS |
|---|---|---|
| CI ngoài → cloud, keyless | **Workload Identity Federation** | IAM Roles + OIDC provider (`sts:AssumeRoleWithWebIdentity`) |
| Workload trong cloud → cloud | Workload Identity (GKE) | IAM Roles for Service Accounts (IRSA) |

Ý tưởng giống nhau: **token ngắn hạn thay key dài hạn**.

### Vị trí trong kiến trúc ERP (CI/CD)

```
GitHub Actions (repo owner/repo)
   │ token OIDC (repository, actor, sub)
   ▼
WIF Pool + Provider  ──verify issuer + attribute_condition──▶ cấp token deployer SA (tạm)
   │
   ▼
deployer SA (có quyền deploy) → push image (Artifact Registry) + Cloud Deploy release
```

## Practical Application

Dùng WIF khi:
- CI/CD **ngoài GCP** (GitHub Actions, GitLab, ...) cần truy cập GCP.
- Muốn bỏ key JSON tĩnh (bảo mật + đỡ rotate).

Nguyên tắc vàng: **không bao giờ tạo SA key** cho CI khi WIF khả dụng.

## References

- [Workload Identity Federation Docs](https://cloud.google.com/iam/docs/workload-identity-federation) — tài liệu chính thức
- [google-github-actions/auth](https://github.com/google-github-actions/auth) — action auth qua WIF
- [GitHub OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect) — token OIDC của GitHub Actions

## Related Concepts

- [Core Concepts](./core-concepts.md) — pool, provider, attribute condition
- [WIF on GCP](./on-gcp.md) — GitHub OIDC, siết bảo mật
- [WIF in This Project](./in-this-project.md) — module workload-identity
