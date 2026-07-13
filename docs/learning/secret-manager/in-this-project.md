---
type: Reference
title: "Secret Manager in This Project"
description: "Mapping Secret Manager → module secrets trong ERP Prototype: 5 secret + pattern per-secret accessor (least privilege)"
tags: [secret-manager, terraform, erp, gcp, security]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://infra/modules/secrets/main.tf"
---

# Secret Manager in This Project

> Mapping từ lý thuyết Secret Manager sang Terraform thật. Module `secrets` tạo 5 secret + bind accessor per-secret.

> Liên quan: [Cloud SQL](../cloud-sql/in-this-project.md) · [IAM & Service Accounts](../iam/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md)

---

## 1. Năm secret

Source: [`infra/modules/secrets/main.tf`](../../infra/modules/secrets/main.tf)

| Secret | Nguồn giá trị | Ai dùng |
|---|---|---|
| `database-url-<env>` | `module.database.connection_url` (pooled) | Backend runtime |
| `database-direct-url-<env>` | `module.database.direct_url` | Prisma migrate |
| `jwt-secret-<env>` | `var.jwt_secret` (tfvars) | Auth Service ký/verify JWT |
| `upstash-redis-url-<env>` | `var.upstash_redis_url` | Cache/session |
| `upstash-redis-token-<env>` | `var.upstash_redis_token` | Cache/session |

## 2. Pattern: mỗi secret = 2 resource

```hcl
# (1) Cái hộp
resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url-${var.environment}"
  replication { auto {} }               # Google tự nhân bản đa vùng
}
# (2) Giá trị (version)
resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url          # chảy từ module.database (sensitive)
}
```

| Field | Giá trị | Ghi chú (xem [Core Concepts](./core-concepts.md)) |
|---|---|---|
| `secret_id` | `database-url-dev` | Tên hộp + suffix môi trường |
| `replication.auto` | `{}` | Nhân bản tự động, không cần chỉ region |
| `secret_data` | từ module/var | Giá trị thực — **sensitive**, không lộ trong plan/log |

## 3. Điểm mấu chốt: Accessor bind PER-SECRET

```hcl
resource "google_secret_manager_secret_iam_member" "backend_accessor" {
  for_each = {
    database_url        = google_secret_manager_secret.database_url.secret_id
    database_direct_url = google_secret_manager_secret.database_direct_url.secret_id
    jwt_secret          = google_secret_manager_secret.jwt_secret.secret_id
    upstash_redis_url   = google_secret_manager_secret.upstash_redis_url.secret_id
    upstash_redis_token = google_secret_manager_secret.upstash_redis_token.secret_id
  }
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.backend_sa_email}"   # erp-backend-<env>
}
```

> [!IMPORTANT]
> **Điểm bảo mật quan trọng nhất của module.** Thay vì cấp `secretAccessor` ở cấp **project** (backend đọc *mọi* secret), quyền bind ở cấp **từng secret** → backend chỉ đọc đúng 5 secret ERP. Mai này ai tạo secret nhạy cảm khác, backend SA **không** tự động đọc được. So với comment trong [module iam](../iam/in-this-project.md) nơi role này *cố ý bị bỏ* khỏi grant project-wide.

## 4. Vòng đời một secret (end-to-end)

```
1. Terraform: module.database xuất connection_url (sensitive)
2. Terraform: module.secrets tạo secret database-url-dev + version chứa giá trị
3. Terraform: bind secretAccessor cho erp-backend-dev TRÊN ĐÚNG secret đó
4. Deploy:    manifest Cloud Run khai env DATABASE_URL → secret_key_ref(database-url-dev, latest)
5. Runtime:   Cloud Run (chạy như erp-backend-dev) xin đọc → IAM check accessor → trả giá trị
6. App:       đọc process.env.DATABASE_URL — không bao giờ thấy password trong image/config
```

## 5. Khi rotate (vd đổi jwt_secret)

```
1. terraform apply với var.jwt_secret mới → tạo secret VERSION mới (latest)
2. Redeploy các service dùng jwt-secret-dev → nạp giá trị mới (BẮT BUỘC)
3. Version cũ disable sau khi chắc không còn revision nào dùng
```

> [!WARNING]
> Bỏ bước 2 → revision đang chạy vẫn ôm giá trị cũ trong RAM. Xem [Core Concepts §5](./core-concepts.md).

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Cloud SQL](../cloud-sql/index.md) · [IAM](../iam/index.md) · [Cloud Run](../cloud-run/index.md)
