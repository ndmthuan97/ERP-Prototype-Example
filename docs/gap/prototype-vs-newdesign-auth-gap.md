---
type: Reference
title: "Prototype vs New ERP Design — Auth & Session Gap Analysis"
description: "So sánh auth/session giữa erp-prototype-example (sau B1: Google sign-in qua Identity Platform + session whitelist) và new-erp-design (Identity Platform + Workspace SSO + Redis cache); FR-A13/FR-A9 đã đóng, còn deviation Workspace domain SSO / MFA / OTP / RBAC-as-code"
tags: [reference, gap-analysis, prototype, auth, session, identity-platform, session-whitelist, new-erp]
timestamp: "2026-07-08T00:00:00+07:00"
diataxis: reference
---

# Prototype vs New ERP Design — Auth & Session Gap Analysis

> **Mục đích:** Đối chiếu cách prototype implement auth/session với thiết kế target trong `new-erp-design/`. Trọng tâm: token lưu ở đâu, mô hình whitelist/blacklist, và khả năng **revoke tức thì**.

> ✅ **Cập nhật B1 (2026-07-08):** prototype đã chuyển off self-rolled email/password JWT sang **Google sign-in qua GCP Identity Platform (Firebase)** + **session whitelist server-side**. Các gap lõi đã đóng: **FR-A13** (revoke tức thì), **FR-A9** (idle timeout theo role), Identity Platform adopted. Còn lại là **deviation cố ý, interim** (chưa có Google Workspace domain): allowlist thay Workspace domain SSO, chưa MFA, chưa external OTP, chưa RBAC-as-code. Xem [ADR-015](../overview/tech-decisions.md).

---

## 1. Prototype thực tế làm gì (sau B1: Google sign-in + session whitelist)

> Nguồn code: [`auth-service/`](../../backend/auth-service/src/), [`api-gateway/src/main.ts`](../../backend/api-gateway/src/main.ts). **Migration B1 (2026-07-08)** đã bỏ self-rolled email/password JWT (`jsonwebtoken` + `bcryptjs`) — nay chỉ còn app token HS256 mang `sid` phía sau lớp Identity Platform + session whitelist.

- **Đăng nhập = "Sign in with Google"** (Firebase JS SDK `signInWithPopup`). Frontend đổi Firebase **ID token** lấy app token qua `POST /auth/sso/callback`.
- **auth-service** `POST /auth/sso/callback`: verify Firebase ID token (firebase-admin) → **allowlist**-check email trong bảng `users` (chưa có Google Workspace domain → gate bằng email pre-provisioned, **KHÔNG** theo `hd` domain) → link `firebaseUid` lần đăng nhập đầu → tạo session (`app_auth.sessions`) → trả **app access token** (HS256, payload có `sid`, TTL `APP_TOKEN_TTL` mặc định 1h). Đăng ký (`/auth/register`) giờ **password-less** — record `users` chính là allowlist entry.
- **Session store**: bảng `app_auth.sessions(id, user_id, started_at, expires_at, ip, user_agent)` (theo new-erp-design `03-module-requirements §3.4 auth.sessions`), cache nóng ở **Redis (Upstash)** key `session:<sid>`.
- **gateway**: verify chữ ký app token (HS256) → check `session:<sid>` ở Redis bằng `getex` (đọc + slide TTL) → miss = **401** (bao trùm logout, deactivation, idle timeout) → bơm `x-user-sid` cùng `x-user-*` cho service phía sau.
- **Revoke tức thì**: `POST /auth/logout` xoá session (đọc `x-user-sid`). Deactivate user (`isActive:false`) revoke **TẤT CẢ** session của user + `revokeRefreshTokens` (Firebase).
- **Đã gỡ**: endpoint login / refresh / đổi password và cơ chế JWT + bcrypt tự cuộn.

| | App access token | Session (whitelist) |
|---|---|---|
| Loại | JWT HS256 tự phát (mang `sid`) | Row `app_auth.sessions` + key Redis `session:<sid>` |
| TTL | `APP_TOKEN_TTL` (mặc định 1h) | idle timeout theo role (mặc định 30m, slide qua `getex`) |
| Verify mỗi request | Chữ ký HS256 (gateway) | **Whitelist** `getex session:<sid>` (miss → 401) |
| Revoke | (không revoke token riêng lẻ) | **Xoá session = chặn TỨC THÌ** (logout / deactivation) |

---

## 2. New ERP Design dự kiến (Identity Platform + session whitelist + Redis)

> Nguồn: [`new-erp-design/decisions/0004-identity-and-sso-strategy.md`](../../../new-erp-design/decisions/0004-identity-and-sso-strategy.md), [`02-new-system-overview.md`](../../../new-erp-design/02-new-system-overview.md), [`03-module-requirements.md`](../../../new-erp-design/03-module-requirements.md)

- **Identity Platform + Google Workspace SSO** lo phát/quản token (D-004). Internal = SSO; external = phone/email + OTP.
- **Session store**: bảng `auth.sessions(id, user_id, started_at, expires_at, ip, user_agent, ...)` ở Cloud SQL, cache nóng ở **Memorystore (Redis)** — "Session cache for web".
- **FR-A9**: idle timeout cấu hình theo role (mặc định 30' internal).
- **FR-A13**: account deactivation (offboarding) **revoke toàn bộ session tức thì**.
- **Redis Basic 5GB** dùng làm cache stateless (session cache, hot-path query cache, Pub/Sub dedup keys); nguồn sự thật ở Postgres/BigQuery.

### Luồng hybrid target (Identity Platform + session whitelist + Redis)

> Design chốt các **component** (Identity Platform, `auth.sessions`, Redis) nhưng để ngỏ cách chúng khớp nhau; đây là luồng interlock cụ thể suy ra từ FR-A9 (idle timeout theo role) + FR-A13 (revoke tức thì). Ý tưởng: **JWT lo verify nhanh (stateless), `auth.sessions` lo revoke/idle (stateful), Redis cache lớp whitelist đó** → lấy cả tốc độ lẫn kiểm soát.

```
Login   → Identity Platform (Workspace SSO / phone-OTP) xác thực
        → phát ID token (JWT ~1h, ký JWKS) + refresh token
        → backend: INSERT auth.sessions (Postgres, expires_at = idle theo role)
                 + SET session:<id> (Redis, TTL = idle)

Request → [1] verify chữ ký JWT (JWKS của Identity Platform, stateless, không đụng store)
        → [2] check whitelist: Redis session:<id> → (miss) Postgres auth.sessions
              └ session bị xoá / hết idle → 401 NGAY (dù chữ ký JWT còn tốt)
        → [3] bơm principal + permissions → service (RBAC / authz.check)

Refresh → /auth/refresh: đẩy expires_at, cấp ID token mới (Identity Platform refresh)
Revoke  → logout / offboarding (FR-A13):
          DELETE auth.sessions + DEL Redis (+ Identity Platform revokeRefreshTokens)
          → chặn TỨC THÌ
```

**Vì sao phải lai:** JWT stateless **không revoke được trước hạn** → cần whitelist tra mỗi request; tra whitelist mỗi request ở Postgres thì **đắt** → Redis cache đỡ tải. Bỏ bước [2] thì mất "revoke tức thì" (FR-A13); bỏ Redis thì DB gánh mỗi request.

**Prototype đang ở đâu trong luồng này (sau B1):** đã có đủ **3 bước** — [1] verify chữ ký (app token HS256), [2] whitelist per-request (`session:<sid>` ở Redis bằng `getex`, hết idle/xoá → 401 ngay), [3] principal + `x-user-sid` qua header. Khác biệt so với luồng target: login xác thực qua **Identity Platform (Google sign-in)** nhưng token per-request là **app token HS256 tự phát** (không verify JWKS Identity Platform mỗi request) — đủ đạt FR-A13/FR-A9. Deviation còn lại nằm ở lớp login: **allowlist email** thay Workspace domain SSO (xem §3).

---

## 3. Gap Summary

| Khía cạnh | Prototype (sau B1) | New Design | Trạng thái |
|---|:---:|:---:|---|
| Token provider (login) | Identity Platform / Google sign-in (Firebase) | Identity Platform + SSO | ✅ Adopted Google sign-in |
| Access token revoke tức thì | ✅ session whitelist per-request → 401 trong vài giây | ✅ bắt buộc (FR-A13) | ✅ **FR-A13 CLOSED** |
| Session store | `app_auth.sessions` (PG) + Redis `session:<sid>` | `auth.sessions` (PG) + Redis cache | ✅ Đã có |
| Verify mỗi request | Chữ ký HS256 + whitelist (`getex`) | Whitelist per-request | ✅ Đã tra store per-request |
| Idle timeout theo role | ✅ slide TTL (`getex`), mặc định 30m | ✅ FR-A9 | ✅ **FR-A9 done** |
| Deactivation revoke toàn bộ session | ✅ revoke all sessions + `revokeRefreshTokens` | ✅ FR-A13 | ✅ Đã có |
| Workspace domain SSO (`hd`) | ❌ interim: allowlist email pre-provisioned | ✅ | ❌ **Deviation** — chờ có Workspace domain |
| MFA | ❌ chưa enforce tập trung (không có Workspace) | ✅ | ❌ **Deviation** (interim) |
| External phone/email OTP (FR-A2) | ❌ out of scope | ✅ | ❌ Chưa làm |
| RBAC-as-code (FR-A4/A6/A8) | ❌ vẫn 3-role hardcode | ✅ | ❌ Out of scope (unchanged) |

---

## 4. Kết luận

**B1 (2026-07-08) đã đóng các gap lõi.** Prototype chuyển off self-rolled email/password JWT sang **Google sign-in qua Identity Platform** + **session whitelist server-side**:

1. ✅ **FR-A13 — revoke tức thì (CLOSED).** Logout xoá session; deactivate user revoke toàn bộ session + `revokeRefreshTokens`. Gateway tra `session:<sid>` mỗi request → token bị thu hồi chết trong vài giây (không còn cửa sổ 15' như bản JWT stateless cũ).
2. ✅ **FR-A9 — idle timeout theo role (done).** `getex` slide TTL mỗi request; mặc định 30m, cấu hình per-role.
3. ✅ **Identity Platform adopted.** Login qua Google sign-in (Firebase), verify ID token bằng firebase-admin, link `firebaseUid`.

**Deviation cố ý so với D-004 (interim, còn mở):**

- ❌ **Workspace domain SSO** — chưa có Google Workspace domain nên gate bằng **allowlist email pre-provisioned** thay cho restrict theo `hd` domain. *Forward path:* khi có Workspace domain → lật allowlist sang `hd` restriction (Workspace SSO).
- ❌ **MFA** — chưa enforce tập trung (phụ thuộc Workspace).
- ❌ **External phone/email OTP (FR-A2)** — out of scope.
- ❌ **RBAC-as-code (FR-A4/A6/A8)** — vẫn mô hình 3-role hardcode, **không đổi**.

## Related Concepts

- [Prototype vs New ERP Design — CDC & Reporting Gap](./prototype-vs-newdesign-cdc-gap.md) — gap phía analytics pipeline
- [ADR-015 — B1: Google sign-in + session whitelist](../overview/tech-decisions.md) — quyết định công nghệ B1
- [Auth Endpoints](../api/auth-endpoints.md) — API reference auth-service (sau B1)
- [Implementation Status](../operations/implementation-status.md) — source of truth trạng thái prototype
- [Known Bugs](../operations/known-bugs.md) — bug đã xác nhận
