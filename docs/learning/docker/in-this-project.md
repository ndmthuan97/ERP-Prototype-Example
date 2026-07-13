---
type: Reference
title: "Docker in This Project"
description: "Mapping Docker → backend/Dockerfile (multi-stage NestJS chung, SERVICE_DIR) + frontend/Dockerfile (Next.js standalone). Non-root, PORT không bake"
tags: [docker, terraform, erp, nestjs, nextjs, multi-stage]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://backend/Dockerfile"
---

# Docker in This Project

> Dự án có **2 Dockerfile**: một chung cho 7 NestJS backend service (tham số hoá bằng `SERVICE_DIR`), một cho frontend Next.js (standalone).

> Liên quan: [Artifact Registry](../artifact-registry/in-this-project.md) · [Cloud Run](../cloud-run/in-this-project.md) · [Cloud Build](../cloud-build/in-this-project.md)

---

## 1. `backend/Dockerfile` — multi-stage chung cho mọi service

Source: [`backend/Dockerfile`](../../backend/Dockerfile)

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS shared-builder            # (1) build thư viện shared trước
COPY shared/package*.json shared/
RUN cd shared && npm ci
COPY shared/ shared/
RUN cd shared && npm run build

FROM base AS service-builder           # (2) build service theo SERVICE_DIR
ARG SERVICE_DIR
COPY --from=shared-builder /app/shared shared/
COPY ${SERVICE_DIR}/ ${SERVICE_DIR}/
RUN cd ${SERVICE_DIR} && npm ci && \
    if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi && \
    npm run build

FROM base AS runner                    # (3) runtime sạch, non-root
ARG SERVICE_DIR
ENV NODE_ENV=production
COPY --from=shared-builder /app/shared shared/
COPY --from=service-builder /app/${SERVICE_DIR}/dist ${SERVICE_DIR}/dist
COPY --from=service-builder /app/${SERVICE_DIR}/node_modules ${SERVICE_DIR}/node_modules
...
WORKDIR /app/${SERVICE_DIR}
USER node
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
```

| Điểm | Ghi chú (xem [Best Practices](./best-practices.md)) |
|---|---|
| **1 Dockerfile, 7 service** | `ARG SERVICE_DIR` chọn service lúc build → không lặp 7 Dockerfile |
| **Shared library stage** | Build `shared` (Redis cache, contracts...) trước, mọi service dùng chung |
| **Multi-stage** | base → shared-builder → service-builder → runner (image cuối nhỏ) |
| **Prisma conditional** | `npx prisma generate` chỉ khi service có `schema.prisma` |
| **`USER node`** | Non-root |
| **KHÔNG bake PORT** | Cloud Run inject `PORT`; local fallback default (auth 3004, gateway 3010...) |
| **CMD linh hoạt** | Chạy `dist/src/main.js` hoặc `dist/main.js` tuỳ cấu trúc build |

> [!NOTE]
> Backend **không** dùng npm workspaces: mỗi service có `node_modules` + Prisma Client riêng; `@erp/shared` là dependency `file:../shared`. Đó là lý do có stage build shared riêng.

## 2. `frontend/Dockerfile` — Next.js standalone

Source: [`frontend/Dockerfile`](../../frontend/Dockerfile)

```dockerfile
FROM node:22-alpine AS builder
COPY package*.json ./ && RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_GATEWAY            # inline vào client bundle LÚC BUILD
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY
RUN npm run build                      # cần next.config: output 'standalone'

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0                    # BẮT BUỘC để Next bind mọi interface
ENV PORT=8080
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
CMD ["node", "server.js"]
```

| Điểm | Ghi chú |
|---|---|
| **`output: 'standalone'`** | Next gói chỉ node_modules cần → image nhỏ |
| **`NEXT_PUBLIC_*` là build ARG** | Biến `NEXT_PUBLIC_API_GATEWAY` inline vào client bundle **lúc build**, không phải runtime → phải truyền qua `--build-arg` trong CI |
| **`HOSTNAME=0.0.0.0`** | Bắt buộc — thiếu thì Next bind hostname container → Cloud Run startup probe fail |
| **`PORT=8080`** | Next standalone dùng (khác backend không bake PORT) |
| **`USER node`** | Non-root |

## 3. Build trong CI

Source: [`.github/workflows/ci-backend.yml`](../../.github/workflows/ci-backend.yml)

```bash
docker build \
  --build-arg SERVICE_DIR=${service} \
  -t us-central1-docker.pkg.dev/$PROJECT/erp-services/${service}:${sha} \
  -t us-central1-docker.pkg.dev/$PROJECT/erp-services/${service}:latest \
  -f backend/Dockerfile backend/
```

GitHub Actions build image (per changed service) → push [Artifact Registry](../artifact-registry/in-this-project.md) (tag `:sha` + `:latest`). Frontend tương tự với `--build-arg NEXT_PUBLIC_API_GATEWAY` (ci-frontend.yml).

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Artifact Registry](../artifact-registry/index.md) · [Cloud Run](../cloud-run/index.md) · [Cloud Build](../cloud-build/index.md)
