# ============================================================
# Next.js Production Dockerfile (Standalone Build)
# ============================================================
# Requires next.config.mjs: output: 'standalone'
# ============================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# NEXT_PUBLIC_* được inline vào client bundle lúc build → PHẢI truyền ở đây,
# không phải runtime. Nhận từ --build-arg trong CI (ci-frontend.yml).
ARG NEXT_PUBLIC_API_GATEWAY
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY

RUN npm run build

# ============================================================
# Production runner — minimal image
# ============================================================

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Cloud Run inject PORT (mặc định 8080). HOSTNAME=0.0.0.0 BẮT BUỘC để
# Next standalone server bind mọi interface — nếu thiếu, server bind vào
# hostname container và startup probe của Cloud Run sẽ fail.
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

# Copy standalone output (includes only needed node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]
