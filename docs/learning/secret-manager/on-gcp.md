---
type: Concept Explanation
title: "Secret Manager on GCP"
description: "Đặc thù GCP: tích hợp Cloud Run (secret_key_ref env vs volume mount), automatic vs user-managed replication, CMEK, IAM audit, mô hình giá"
tags: [secret-manager, gcp, cloud-run, replication, cmek, pricing]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Secret Manager on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách secret **chảy vào** service và cách tính tiền.

## Cách hoạt động

### 1. Tích hợp Cloud Run — 2 cách inject

| Cách | Cơ chế | Dùng khi |
|---|---|---|
| **Secret → Env var** (`secret_key_ref`) | Giá trị secret gán vào biến env lúc start | Đa số bí mật ngắn (URL, token) — dự án dùng |
| **Secret → Volume mount** | Secret mount thành file trong container | File cert/key, hoặc muốn cập nhật không qua env |

```hcl
# Env var kiểu secret (dự án dùng)
env {
  name = "DATABASE_URL"
  value_source { secret_key_ref { secret = "database-url-dev", version = "latest" } }
}
```

> [!IMPORTANT]
> Cloud Run resolve secret **lúc khởi động revision** → giữ trong RAM. Đây là lý do **rotate phải redeploy** (xem [Core Concepts §5](./core-concepts.md)). Volume mount có thể cấu hình đọc lại, nhưng env var thì cố định theo revision.

### 2. Ai đọc được — runtime SA + accessor

Cloud Run resolve secret **dưới danh tính runtime SA**. SA đó phải có `roles/secretmanager.secretAccessor` trên đúng secret.

```
Cloud Run (chạy như erp-backend-dev) xin đọc database-url-dev
   → IAM check: erp-backend-dev có secretAccessor trên secret này?
   → có → trả giá trị ; không → service crash lúc start
```

### 3. Replication: Automatic vs User-managed

| | Automatic (`auto {}`) | User-managed |
|---|---|---|
| Cấu hình | Không cần chỉ region | Liệt kê region cụ thể |
| Khi nào | Mặc định, đơn giản (dự án dùng) | Có ràng buộc data residency |

### 4. CMEK — tự quản khoá mã hoá

Mặc định Google mã hoá secret bằng khoá của Google. **CMEK** (Customer-Managed Encryption Key) cho phép bạn dùng khoá riêng (Cloud KMS) — khi compliance yêu cầu. Dự án dùng mặc định (chưa cần CMEK).

### 5. Versioning & Audit

- Mỗi thay đổi giá trị = version mới → có **lịch sử**.
- Mọi lần truy cập secret ghi vào **Cloud Audit Logs** → biết SA nào đọc secret nào, khi nào.

### 6. Mô hình giá

```
Chi phí ≈ (số active secret version) + (số lần truy cập/10k) [+ CMEK nếu dùng]
```

| Yếu tố | Ghi chú |
|---|---|
| Active version | Tính theo số version đang ENABLED — dọn version cũ để tiết kiệm |
| Access operations | Tính theo lượt gọi đọc |

> [!TIP]
> Cloud Run đọc secret lúc start (không phải mỗi request) → chi phí access thấp. Nhưng đừng để hàng trăm version cũ ENABLED — disable/destroy sau rotate.

## Ví dụ thực tế

```
5 secret ERP, mỗi cái auto replication, backend SA có accessor per-secret:
  database-url-dev, database-direct-url-dev, jwt-secret-dev,
  upstash-redis-url-dev, upstash-redis-token-dev
Cloud Run inject cả 5 qua secret_key_ref (version=latest)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Service crash: "permission denied on secret" | Runtime SA thiếu accessor | Bind per-secret cho runtime SA |
| Rotate không hiệu lực | Env resolve lúc start, chưa redeploy | Deploy revision mới |
| Hoá đơn secret tăng dần | Nhiều version cũ còn ENABLED | Disable/destroy version cũ |
| Không biết ai đọc secret | Chưa xem audit log | Bật/đọc Cloud Audit Logs |

## Related Concepts

- [Core Concepts](./core-concepts.md) — version, rotation, accessor
- [Secret Manager in This Project](./in-this-project.md) — 5 secret + per-secret accessor
- [Cloud Run in This Project](../cloud-run/in-this-project.md) — secret_key_ref
