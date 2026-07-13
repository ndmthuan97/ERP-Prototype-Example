---
type: Concept Explanation
title: "Docker Best Practices"
description: "Quy tắc 80/20: multi-stage build, base image nhỏ, thứ tự layer cho cache, chạy non-root, .dockerignore, KHÔNG bake secret, image bất biến"
tags: [docker, best-practices, multi-stage, non-root, security, image-size]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Docker Best Practices

## Định nghĩa

Bộ quy tắc để image **nhỏ, build nhanh, an toàn**. Dự án áp dụng gần hết — xem [in-this-project](./in-this-project.md).

## Cách hoạt động

### 1. Multi-stage build — tách build khỏi runtime

Dùng nhiều `FROM`: stage build có compiler/dev-deps; stage runtime **chỉ** lấy artifact cần chạy → image cuối nhỏ.

```dockerfile
FROM node:22-alpine AS build       # có dev deps, compiler
RUN npm ci && npm run build
FROM node:22-alpine AS runner      # runtime sạch
COPY --from=build /app/dist ./dist    # chỉ lấy dist + prod deps
```

> [!IMPORTANT]
> Multi-stage là **đòn bẩy lớn nhất** giảm kích thước image: build tool (TypeScript, dev deps) không lọt vào image production.

### 2. Base image nhỏ

| Base | Kích thước | Ghi chú |
|---|---|---|
| `node:22` | ~1GB | Đầy đủ, nặng |
| `node:22-alpine` | ~150MB | Nhỏ (musl libc) — **dự án dùng** |
| `distroless` | Nhỏ nhất | Không shell → khó debug |

Nhỏ hơn = pull nhanh, ít bề mặt tấn công. Alpine là cân bằng tốt.

### 3. Thứ tự layer tối ưu cache

Cài dependency (ít đổi) **trước** copy source (hay đổi) → sửa code không phá cache cài deps. Xem [Core Concepts §3](./core-concepts.md).

### 4. Chạy non-root

Mặc định container chạy `root` → rủi ro nếu bị chiếm. Chuyển sang user thường:

```dockerfile
USER node      # uid 1000, có sẵn trong image node
```

> [!IMPORTANT]
> **Luôn drop root.** Dự án cả 2 Dockerfile đều `USER node`. Container chạy root là lỗ hổng leo thang đặc quyền phổ biến.

### 5. `.dockerignore`

Loại `node_modules`, `.git`, file test, secret khỏi build context → build nhanh, image sạch, không lỡ copy secret.

### 6. KHÔNG bake secret vào image

> [!WARNING]
> **Không** `ENV DB_PASSWORD=...` hay `COPY .env` vào image. Ai pull được image = đọc được secret (kể cả trong layer cũ đã "xoá"). Secret nạp lúc **runtime** từ Secret Manager qua `secret_key_ref` — xem [Secret Manager](../secret-manager/index.md).

### 7. Không hardcode PORT (cho Cloud Run)

Cloud Run **inject** `PORT` lúc runtime; app đọc `process.env.PORT`. `ENV PORT=3001` cứng sẽ ghim sai port → startup probe fail. (Frontend Next standalone là ngoại lệ có kiểm soát — xem [in-this-project](./in-this-project.md).)

### 8. Build args cho biến build-time

`ARG` truyền giá trị **lúc build** (khác `ENV` runtime). Ví dụ dự án: `SERVICE_DIR` (chọn service), `NEXT_PUBLIC_API_GATEWAY` (inline vào client bundle Next).

## Ví dụ thực tế (checklist)

```
[✓] Multi-stage (build → runner)
[✓] Base alpine nhỏ
[✓] COPY manifest trước, source sau (cache)
[✓] USER node (non-root)
[✓] .dockerignore
[✓] Secret nạp runtime, không bake
[✓] PORT không hardcode (backend)
```

## Lỗi thường gặp

| Anti-pattern | Hệ quả | Thay bằng |
|---|---|---|
| 1 stage, giữ dev deps | Image phình | Multi-stage |
| `FROM node:22` (full) | Nặng, nhiều CVE | `node:22-alpine` |
| Chạy root | Rủi ro bảo mật | `USER node` |
| `COPY .env` / ENV secret | Lộ secret trong image | Secret Manager runtime |
| Hardcode `ENV PORT` | Sai port → probe fail | Đọc `process.env.PORT` |

## Related Concepts

- [Core Concepts](./core-concepts.md) — layer, cache, CMD
- [Docker in This Project](./in-this-project.md) — 2 Dockerfile áp dụng
- [Secret Manager](../secret-manager/index.md) — vì sao không bake secret
