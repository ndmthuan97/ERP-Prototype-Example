---
type: Reference
title: "Docker — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: image phình, build cache miss, chạy root, hardcode PORT, HOSTNAME sai (Next), secret trong image, build context lớn"
tags: [docker, troubleshooting, pitfalls, image-size, security, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://backend/Dockerfile"
---

# Docker — Troubleshooting & Pitfalls

> Tra cứu nhanh khi build chậm, image to, hoặc container không lên trên Cloud Run.

## 1. Build chậm / cache

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Mỗi lần build đều cài lại deps | `COPY . .` trước `npm ci` → cache miss | COPY `package*.json` + `npm ci` trước, `COPY . .` sau |
| Build gửi cả GB context | Thiếu `.dockerignore` | Thêm `.dockerignore` (node_modules, .git, .next) |
| Prisma lỗi lúc build | Chưa `prisma generate` | Generate trong Dockerfile (conditional) như dự án |

## 2. Kích thước image

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Image hàng GB | 1 stage, giữ dev deps + toolchain | Multi-stage (build → runner) |
| Image nặng dù multi-stage | Base `node:22` full | Đổi `node:22-alpine` |

## 3. Chạy trên Cloud Run

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `failed to listen on PORT` | App không đọc `$PORT` / hardcode PORT | Backend: đọc `process.env.PORT`, không bake |
| Frontend Next probe fail | Thiếu `HOSTNAME=0.0.0.0` | Set `ENV HOSTNAME=0.0.0.0` (Next standalone) |
| Container start rồi chết ngay | CMD sai đường dẫn entry | Kiểm `dist/src/main.js` vs `dist/main.js` (CMD dự án tự dò) |
| `NEXT_PUBLIC_*` rỗng ở client | Truyền lúc runtime thay vì build | Truyền `--build-arg` khi build frontend |

## 4. Bảo mật

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Chạy root | Leo thang đặc quyền nếu bị chiếm | `USER node` |
| `COPY .env` / `ENV SECRET=` | Secret lộ trong layer image | Nạp runtime từ Secret Manager |
| Copy nhầm file nhạy cảm | Lộ qua image | `.dockerignore` |

## 5. Debug nhanh

```bash
# Xem kích thước + layer history
docker images
docker history <image>

# Chạy thử local (backend service, PORT unset → dùng default service)
docker build --build-arg SERVICE_DIR=auth-service -t auth-test -f backend/Dockerfile backend/
docker run --rm -p 3004:3004 auth-test

# Soi bên trong (alpine có sh)
docker run --rm -it --entrypoint sh <image>
```

## Related Concepts

- [Docker in This Project](./in-this-project.md) — 2 Dockerfile
- [Best Practices](./best-practices.md) — multi-stage, non-root, secret
- [Cloud Run Troubleshooting](../cloud-run/troubleshooting-and-pitfalls.md) — container không start
