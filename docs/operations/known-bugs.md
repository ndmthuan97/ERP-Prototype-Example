---
type: Runbook
title: Known Bugs
description: Danh sách bug đã phát hiện. Mỗi bug ghi rõ triệu chứng, root cause, và fix.
tags: [bugs, backlog, swagger, gateway]
timestamp: 2026-07-07
diataxis: reference
---

# Known Bugs

Danh sách bug đã xác nhận. Cập nhật trạng thái khi sửa xong.

## Open

_(Không có)_

## Resolved

### BUG-003: Swagger Authorize nhập token nhưng request không gửi Authorization header

| | |
|---|---|
| **Phát hiện** | 2026-07-07 |
| **Fix** | 2026-07-07 |
| **Service** | Tất cả 6 service |

**Root cause**: `.addBearerAuth()` khai báo security scheme nhưng thiếu `.addSecurity('bearer', [])` → Swagger UI không gắn `Authorization` header vào request.

**Fix**: Thêm `.addSecurityRequirements('bearer')` vào 6 file `main.ts` (auth, customer, sales, inventory, catalog, purchasing).

---

### BUG-002: `/metrics` bị gateway JWT chặn

| | |
|---|---|
| **Phát hiện** | 2026-07-07 |
| **Fix** | 2026-07-07 |
| **Service** | api-gateway |

**Root cause**: `/metrics` không nằm trong `PUBLIC_ROUTES` → gateway JWT middleware chặn.

**Fix**: Thêm `{ method: 'GET', path: /^\/metrics$/ }` vào `PUBLIC_ROUTES` trong `api-gateway/src/main.ts`.

---

### BUG-001: Swagger UI hiển thị internal headers là required parameter

| | |
|---|---|
| **Phát hiện** | 2026-07-07 |
| **Fix** | 2026-07-07 |
| **Service** | auth-service (duy nhất dùng `@Headers('x-user-*')`) |

**Root cause**: NestJS Swagger plugin quét `@Headers('x-user-id')` → tạo OpenAPI parameter required. Thực tế gateway tự gắn header này.

**Fix**: Post-process OpenAPI doc trong `auth-service/src/main.ts` — strip tất cả parameters có `name.startsWith('x-user-')` khỏi spec. Và trong `shared/src/observability/metrics.ts` chuyển `@Headers('authorization')` sang `@Req()` để Swagger không quét.
