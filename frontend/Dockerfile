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
RUN npm run build

# ============================================================
# Production runner — minimal image
# ============================================================

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone output (includes only needed node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
