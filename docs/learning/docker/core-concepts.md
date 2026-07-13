---
type: Concept Explanation
title: "Docker Core Concepts"
description: "Building blocks: Dockerfile, Image & Layer, Build cache, Container, Port/Env, Volume, ENTRYPOINT vs CMD, build context & .dockerignore"
tags: [docker, dockerfile, image, layer, build-cache, container, cmd]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Docker Core Concepts

## Định nghĩa

Docker xây trên vài khái niệm cốt lõi. Nắm chúng = viết Dockerfile build nhanh (cache), image nhỏ, chạy đúng.

## Tại sao quan trọng

Không hiểu layer/cache → build chậm mỗi lần. Không hiểu CMD/PORT → container không start. Không hiểu build context → gửi cả GB rác lên build.

## Cách hoạt động

### 1. Dockerfile — công thức build image

Tập lệnh mô tả cách dựng image, từng dòng tạo một **layer**:

```dockerfile
FROM node:22-alpine        # base image
WORKDIR /app
COPY package*.json ./      # copy manifest trước (cache-friendly)
RUN npm ci                 # cài deps
COPY . .                   # copy source
RUN npm run build          # build
CMD ["node", "dist/main.js"]
```

### 2. Image & Layer — xếp chồng, chia sẻ

Image gồm nhiều **layer** đọc-only xếp chồng. Layer trùng được **chia sẻ & cache** giữa các image.

```
CMD ...            ← layer 5
RUN npm build      ← layer 4
COPY . .           ← layer 3
RUN npm ci         ← layer 2   (chia sẻ nếu package.json không đổi)
FROM node:alpine   ← layer 1   (base, chia sẻ mọi image cùng base)
```

### 3. Build cache — vì sao thứ tự COPY quan trọng

Docker cache theo layer: nếu input một layer **không đổi**, dùng lại cache; đổi thì layer đó **và mọi layer sau** phải build lại.

```dockerfile
# ✅ Tốt: manifest ít đổi → COPY trước → `npm ci` được cache khi chỉ sửa code
COPY package*.json ./
RUN npm ci
COPY . .

# ❌ Xấu: COPY . . trước → mỗi lần sửa 1 dòng code → npm ci chạy lại (chậm)
COPY . .
RUN npm ci
```

> [!IMPORTANT]
> Đặt lệnh **ít thay đổi** (cài deps) **trước** lệnh **hay thay đổi** (copy source). Đây là đòn bẩy tốc độ build lớn nhất.

### 4. Container — image đang chạy

`docker run image` tạo container. Ghi vào container không đổi image (image bất biến); mất khi container bị xoá (trừ volume).

### 5. Port & Env

- `EXPOSE 8080`: **chỉ tài liệu** — không tự mở port (Cloud Run route theo PORT inject).
- `ENV KEY=value`: biến môi trường; nhưng **không bake secret** vào ENV (xem [Best Practices](./best-practices.md)).
- App nên đọc `process.env.PORT` — không hardcode.

### 6. Volume — dữ liệu bền

Container stateless; muốn dữ liệu tồn tại qua restart → **volume** (mount ngoài). Cloud Run gần như stateless hoàn toàn → đẩy state ra DB/Redis thay vì volume.

### 7. ENTRYPOINT vs CMD

| | Ý nghĩa |
|---|---|
| `ENTRYPOINT` | Lệnh cố định luôn chạy |
| `CMD` | Lệnh/tham số mặc định (dễ override lúc `docker run`) |

```dockerfile
CMD ["node", "dist/main.js"]     # chạy app khi container start
```

### 8. Build context & `.dockerignore`

`docker build <context>` gửi **toàn bộ context** cho daemon. `.dockerignore` loại `node_modules`, `.git`... khỏi context → build nhanh, image sạch.

## Ví dụ thực tế

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./     # cache deps
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine       # runtime nhỏ (multi-stage)
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
CMD ["node", "dist/main.js"]
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Build chậm mỗi lần | COPY source trước cài deps → cache miss | COPY manifest + install trước |
| Image quá lớn | Copy cả node_modules dev, không multi-stage | Multi-stage; `.dockerignore` |
| Container không start | Không đọc `$PORT` / sai CMD | Bind `process.env.PORT`; kiểm CMD |
| Build gửi cả GB | Thiếu `.dockerignore` | Thêm `.dockerignore` (node_modules, .git) |

## Related Concepts

- [Overview](./overview.md) — container vs VM, image vs container
- [Best Practices](./best-practices.md) — multi-stage, non-root, secret
- [Docker in This Project](./in-this-project.md) — 2 Dockerfile thật
