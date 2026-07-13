---
type: System Component
title: "Auth Service"
description: "Google sign-in (Identity Platform) SSO, app token HS256 + session whitelist (Redis), password-less register, and RBAC 3 roles (admin/manager/staff)"
resource: "http://localhost:3004"
tags: [system, component, auth, identity-platform, sso, session, rbac]
timestamp: "2026-07-08T00:00:00+07:00"
---

# Auth Service

> ✅ **B1 (2026-07-08):** auth chuyển sang **Google sign-in qua Identity Platform (Firebase)** + **session whitelist** (`app_auth.sessions` + Redis) cho revoke tức thì. Endpoint login/refresh + password/bcrypt tự cuộn **đã gỡ**. Xem [Auth Endpoints](../api/auth-endpoints.md), [ADR-015](../overview/tech-decisions.md).

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3004` |
| **Schema** | `app_auth` |
| **Vai trò** | Supporting Context — xác thực, phân quyền cho toàn hệ thống |
| **Patterns** | Identity Platform (Google sign-in), App token HS256, Session Whitelist, RBAC, DDD 4 layers |

Auth Service quản lý vòng đời authentication: đăng ký user **password-less** (chỉ admin), đăng nhập qua **Google sign-in** (`POST /auth/sso/callback` → app token HS256 có `sid`), logout (xoá session). RBAC 3 roles (admin/manager/staff) được enforce tại API Gateway.

## Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|:----:|-------|
| POST | `/auth/register` | admin | Tạo user password-less (email + role + fullName) |
| POST | `/auth/sso/callback` | public | Đổi Firebase ID token → app token HS256 (verify + allowlist email) |
| POST | `/auth/logout` | Bearer | Xoá session hiện tại (`x-user-sid`) → revoke tức thì |
| GET | `/auth/me` | Bearer | Thông tin user hiện tại |

Chi tiết request/response: [auth-endpoints.md](../api/auth-endpoints.md). Deactivate user (`isActive:false`) revoke **toàn bộ** session + `revokeRefreshTokens` (Firebase).

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Identity Platform (Firebase) | External | Google sign-in; verify Firebase ID token bằng `firebase-admin` |
| PostgreSQL (Cloud SQL) | External | Schema `app_auth` — `users`, `sessions`, `refresh_tokens` (deprecated) |
| Redis (Upstash) | External | Session whitelist `session:<sid>` (revoke tức thì + idle timeout) |
| API Gateway | Internal | Gateway tự verify app token HS256 + tra `session:<sid>`; forward `/auth/*` |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `JWT_SECRET` | ✅ | Secret HS256 ký/verify app token (min 32 chars, dùng chung với Gateway) |
| `APP_TOKEN_TTL` | ✅ | App token TTL (mặc định `1h`) |
| `FIREBASE_PROJECT_ID` | ✅ | Project Identity Platform để verify ID token (firebase-admin) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ✅ | Redis cho session whitelist |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |

## Key Resources

- **API Reference**: [auth-endpoints.md](../api/auth-endpoints.md)
- **Bounded Context**: [bounded-contexts.md §3.1](../architecture/bounded-contexts.md)
- **Data Model**: [data-model.md §2](../architecture/data-model.md)
- **RBAC Detail**: [rbac.md](../architecture/rbac.md)
- **Design Patterns**: [design-patterns.md §11](../architecture/design-patterns.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../operations/implementation-status.md)

## Related Concepts

- [API Gateway](./api-gateway.md) — JWT verification + proxy routing
- [Customer Service](./customer-service.md) — protected by Auth
