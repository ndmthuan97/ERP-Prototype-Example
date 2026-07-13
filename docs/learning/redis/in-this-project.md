---
type: Reference
title: "Redis in This Project"
description: "Mapping Redis → shared/cache/RedisCacheService trong ERP Prototype: Upstash REST client, cache + idempotency + session whitelist (B1), credentials từ Secret Manager"
tags: [redis, upstash, terraform, erp, cache, idempotency, session, nestjs]
diataxis: reference
timestamp: "2026-07-08T00:00:00+07:00"
resource: "file://backend/shared/src/cache/redis-cache.service.ts"
---

# Redis in This Project

> Redis trong ERP = **Upstash Redis** (REST API), gói trong `RedisCacheService` ở thư viện `shared`, dùng chung cho mọi backend service. Dùng cho **cache** + **idempotency** + **session whitelist** (auth, sau B1).

> Liên quan: [Secret Manager](../secret-manager/in-this-project.md) · [Pub/Sub](../pubsub/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md)

---

## 1. Không có Terraform module — chỉ có credentials

> [!IMPORTANT]
> Upstash là **dịch vụ external** (không phải GCP), **không** provision bằng Terraform. Terraform chỉ **cất credentials** vào Secret Manager (`upstash-redis-url-<env>`, `upstash-redis-token-<env>` — xem [module secrets](../secret-manager/in-this-project.md)). Bản thân Redis instance tạo trên Upstash console.

## 2. RedisCacheService — client dùng chung

Source: [`backend/shared/src/cache/redis-cache.service.ts`](../../backend/shared/src/cache/redis-cache.service.ts)

```ts
import { Redis } from '@upstash/redis';

export class RedisCacheService {
  private readonly redis: Redis;
  constructor() {
    this.redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL   ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });
  }
  getClient(): Redis { return this.redis; }        // client thô — cho idempotency
  async health(): Promise<boolean> { ... ping ... }
  async get<T>(key): Promise<T | null> { ... }
  async set(key, value, ttl): Promise<void> { ... redis.set(key, value, { ex: ttl }) }
  async del(key): Promise<void> { ... }
}
```

| Thành phần | Ghi chú |
|---|---|
| `@upstash/redis` | Client **REST** (HTTP), hợp serverless — xem [on-gcp](./on-gcp.md) |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Đọc từ env, inject từ Secret Manager qua `secret_key_ref` |
| `get/set/del` | Cache-aside cơ bản; `set` có TTL (`ex`) |
| `getClient()` | Trả client thô cho `withIdempotency` (cần lệnh atomic) |
| `health()` | `ping` Redis — dùng cho health check service |

## 3. Ba công dụng

### (a) Cache-aside

Đệm dữ liệu đọc nhiều trước Cloud SQL: miss → query DB → `set` với TTL. Giảm tải DB (`max_connections=50` — xem [Cloud SQL](../cloud-sql/in-this-project.md)).

### (b) Idempotency (dedupe Pub/Sub)

Consumer Pub/Sub nhận message **at-least-once** → có thể trùng. `withIdempotency` dùng client thô + lệnh atomic để đảm bảo xử lý **đúng 1 lần**:

```
đã xử lý eventId chưa? (atomic SET NX trên Redis)
  chưa → xử lý (trừ/cộng kho) + đánh dấu
  rồi  → bỏ qua
```

> Liên hệ: [Pub/Sub Core Concepts §5](../pubsub/core-concepts.md) (at-least-once) + [Redis Core Concepts §7](./core-concepts.md) (idempotency key).

### (c) Session whitelist (auth — sau B1)

B1 thêm lớp **revoke tức thì**: mỗi phiên đăng nhập có key `session:<sid>` ở Redis. **Gateway** tra `getex session:<sid>` mỗi request (đọc + slide TTL = idle timeout); miss → 401 (logout / deactivation / idle). Login (`/auth/sso/callback`) tạo session, `/auth/logout` xoá session. Đạt **FR-A13** (revoke tức thì) + **FR-A9** (idle timeout theo role).

> Dùng client thô (`getClient()`) cho lệnh `getex`. Chi tiết: [Auth Endpoints](../../api/auth-endpoints.md) · [RBAC §3](../../architecture/rbac.md).

## 4. Credentials chảy vào runtime (end-to-end)

```
Upstash console → tạo Redis, lấy REST URL + token
   ↓ điền vào tfvars (sensitive)
Terraform module.secrets → secret upstash-redis-url-dev / upstash-redis-token-dev
   ↓ manifest Cloud Run (deploy/*/service.yaml) khai env qua secretKeyRef
Cloud Run runtime → UPSTASH_REDIS_REST_URL / _TOKEN → RedisCacheService kết nối
```

> [!NOTE]
> Tên env trong code là `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; secret trong Secret Manager tên `upstash-redis-url-<env>` / `upstash-redis-token-<env>`. Manifest service.yaml ánh xạ secret → đúng tên env này.

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Secret Manager](../secret-manager/index.md) · [Pub/Sub](../pubsub/index.md) · [Cloud Run](../cloud-run/index.md)
