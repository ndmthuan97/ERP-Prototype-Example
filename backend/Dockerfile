# ============================================================
# Dockerfile chung cho tất cả NestJS services
# ============================================================
# Multi-stage build: cài deps + build shared → chạy service
#
# Build args:
#   SERVICE_DIR  — tên folder service (customer-service, sales-service, ...)
#   SERVICE_PORT — port service listen
#
# Usage:
#   docker build --build-arg SERVICE_DIR=customer-service --build-arg SERVICE_PORT=3001 -t erp-customer .
# ============================================================

FROM node:22-alpine AS base
WORKDIR /app

# ---- Stage 1: Install & Build shared library ----
FROM base AS shared-builder
COPY shared/package*.json shared/
RUN cd shared && npm ci
COPY shared/ shared/
RUN cd shared && npm run build

# ---- Stage 2: Install service deps + build ----
FROM base AS service-builder
ARG SERVICE_DIR

# Copy shared (built) — needed as file: dependency
COPY --from=shared-builder /app/shared shared/

# Install service dependencies (includes prisma generate via postinstall)
COPY ${SERVICE_DIR}/package*.json ${SERVICE_DIR}/
COPY ${SERVICE_DIR}/prisma/ ${SERVICE_DIR}/prisma/
RUN cd ${SERVICE_DIR} && npm ci

# Copy service source & build
COPY ${SERVICE_DIR}/ ${SERVICE_DIR}/
RUN cd ${SERVICE_DIR} && npm run build

# ---- Stage 3: Production-like runtime ----
FROM base AS runner
ARG SERVICE_DIR
ARG SERVICE_PORT=3001

ENV NODE_ENV=production
ENV PORT=${SERVICE_PORT}

# Copy only what's needed to run
COPY --from=shared-builder /app/shared shared/
COPY --from=service-builder /app/${SERVICE_DIR}/node_modules ${SERVICE_DIR}/node_modules
COPY --from=service-builder /app/${SERVICE_DIR}/dist ${SERVICE_DIR}/dist
COPY --from=service-builder /app/${SERVICE_DIR}/prisma ${SERVICE_DIR}/prisma
COPY --from=service-builder /app/${SERVICE_DIR}/package.json ${SERVICE_DIR}/package.json

WORKDIR /app/${SERVICE_DIR}
EXPOSE ${SERVICE_PORT}

CMD ["node", "dist/main.js"]
