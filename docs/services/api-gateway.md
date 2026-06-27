---
type: System Component
title: "API Gateway"
description: "Centralized entry point with JWT verification, RBAC enforcement, reverse proxy to 6 services, Helmet, and rate limiting"
resource: "http://localhost:3010"
tags: [system, component, gateway, jwt, proxy, rate-limiting]
timestamp: "2026-06-26T00:00:00+07:00"
---

# API Gateway

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3010` |
| **Schema** | — (không có DB) |
| **Vai trò** | Infrastructure — single entry point cho toàn hệ thống |
| **Patterns** | API Gateway, JWT Guard, RBAC, Rate Limiting |

API Gateway là điểm truy cập duy nhất. Frontend gọi Gateway → Gateway verify JWT → check RBAC → proxy tới service backend tương ứng. Áp dụng Helmet security headers và rate limiting (100 req/15min global, 5 req/15min login).

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Auth Service | Internal | Verify JWT tokens |
| Customer Service | Internal | Proxy `/api/customers/*` → `:3001` |
| Sales Service | Internal | Proxy `/api/orders/*` → `:3002` |
| Inventory Service | Internal | Proxy `/api/inventory/*` → `:3003` |
| Catalog Service | Internal | Proxy `/api/catalog/*` → `:3005` |
| Purchasing Service | Internal | Proxy `/api/purchasing/*` → `:3006` |
| Purchasing Service | Internal | Proxy `/api/suppliers/*` → `:3006` |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `JWT_SECRET` | ✅ | Shared JWT secret (same as Auth Service) |
| `AUTH_SERVICE_URL` | ✅ | Auth Service URL |
| `CUSTOMER_SERVICE_URL` | ✅ | Customer Service URL |
| `ORDER_SERVICE_URL` | ✅ | Sales Service URL |
| `INVENTORY_SERVICE_URL` | ✅ | Inventory Service URL |
| `CATALOG_SERVICE_URL` | ✅ | Catalog Service URL |
| `PURCHASING_SERVICE_URL` | ✅ | Purchasing Service URL |

## Proxy Route Map

| Gateway Path | Target Service | Port |
|-------------|---------------|------|
| `/api/auth/*` | Auth Service | `:3004` |
| `/api/customers/*` | Customer Service | `:3001` |
| `/api/orders/*` | Sales Service | `:3002` |
| `/api/inventory/*` | Inventory Service | `:3003` |
| `/api/catalog/*` | Catalog Service | `:3005` |
| `/api/purchasing/*` | Purchasing Service | `:3006` |
| `/api/suppliers/*` | Purchasing Service | `:3006` |

## Key Resources

- **RBAC Detail**: [rbac.md](../architecture/rbac.md)
- **System Overview**: [system-overview.md §4](../architecture/system-overview.md)
- **Design Patterns**: [design-patterns.md §10, §11](../architecture/design-patterns.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Auth Service](./auth-service.md) — JWT token verification
- [All backend services](./index.md) — proxied through Gateway
