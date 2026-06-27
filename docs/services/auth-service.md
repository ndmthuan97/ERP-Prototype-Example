---
type: System Component
title: "Auth Service"
description: "JWT authentication with bcrypt password hashing, refresh tokens, and RBAC 3 roles (admin/manager/staff)"
resource: "http://localhost:3004"
tags: [system, component, auth, jwt, rbac]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Auth Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3004` |
| **Schema** | `app_auth` |
| **Vai trò** | Supporting Context — xác thực, phân quyền cho toàn hệ thống |
| **Patterns** | JWT, bcrypt, RBAC, DDD 4 layers |

Auth Service quản lý vòng đời authentication: đăng ký user, đăng nhập (cấp JWT), refresh token, logout. RBAC 3 roles (admin/manager/staff) được enforce tại API Gateway.

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `app_auth` — users, refresh_tokens |
| API Gateway | Internal | Gateway verify JWT token qua Auth Service |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `JWT_SECRET` | ✅ | Secret key cho JWT (min 32 chars) |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (e.g., `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g., `7d`) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |

## Key Resources

- **API Reference**: [auth-endpoints.md](../api/auth-endpoints.md)
- **Bounded Context**: [bounded-contexts.md §3.1](../architecture/bounded-contexts.md)
- **Data Model**: [data-model.md §2](../architecture/data-model.md)
- **RBAC Detail**: [rbac.md](../architecture/rbac.md)
- **Design Patterns**: [design-patterns.md §11](../architecture/design-patterns.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [API Gateway](./api-gateway.md) — JWT verification + proxy routing
- [Customer Service](./customer-service.md) — protected by Auth
