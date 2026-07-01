# ============================================================
# Dockerfile chung cho tất cả NestJS services
# ============================================================
# Build args:
#   SERVICE_DIR  — tên folder service (customer-service, sales-service, ...)
# Port: KHÔNG bake — Cloud Run inject PORT lúc runtime (xem stage runner).
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

COPY --from=shared-builder /app/shared shared/

# Copy entire service directory (handles prisma or no-prisma uniformly)
COPY ${SERVICE_DIR}/ ${SERVICE_DIR}/
RUN cd ${SERVICE_DIR} && npm ci && \
    if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi && \
    npm run build

# Ensure prisma dir always exists (empty for services without prisma)
RUN mkdir -p ${SERVICE_DIR}/prisma

# ---- Stage 3: Production runtime ----
FROM base AS runner
ARG SERVICE_DIR

ENV NODE_ENV=production
# Do NOT bake PORT here. Cloud Run injects PORT (= the service's configured
# container_port) at runtime and the app reads process.env.PORT. A hardcoded
# ENV PORT=3001 would pin every service to 3001 regardless of its real port,
# so the startup probe (which targets the configured port) never connects.
# Locally (docker run / compose) PORT is unset → each service falls back to its
# own default (auth 3004, gateway 3010, ...).

COPY --from=shared-builder /app/shared shared/
COPY --from=service-builder /app/${SERVICE_DIR}/node_modules ${SERVICE_DIR}/node_modules
COPY --from=service-builder /app/${SERVICE_DIR}/dist ${SERVICE_DIR}/dist
COPY --from=service-builder /app/${SERVICE_DIR}/package.json ${SERVICE_DIR}/package.json
COPY --from=service-builder /app/${SERVICE_DIR}/prisma ${SERVICE_DIR}/prisma

WORKDIR /app/${SERVICE_DIR}
# EXPOSE is documentation only (Cloud Run ignores it and routes to the
# configured container_port via the injected PORT env var).
EXPOSE 8080

# Drop root — run as the unprivileged `node` user (uid 1000, present in the
# base image). Copied artifacts are world-readable, so reads still work.
USER node

CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
