---
type: API Endpoint
title: "Auth Service API"
description: "Authentication endpoints: Google sign-in (Identity Platform) SSO callback, logout (session revoke), password-less register, /me; app token HS256 + session whitelist + RBAC"
resource: "http://localhost:3004"
tags: [api, auth, identity-platform, sso, session, rbac]
timestamp: "2026-07-08T00:00:00+07:00"
---

# Auth Service — API Endpoints

> ✅ **Đã implement (B1, 2026-07-08).** Auth chuyển sang **Google sign-in qua GCP Identity Platform (Firebase)** + **session whitelist** (`app_auth.sessions` + Redis) cho revoke tức thì. Endpoint login/refresh + đổi password JWT tự cuộn **đã gỡ**. Xem [Implementation Status](../operations/implementation-status.md), [Auth & Session Gap](../gap/prototype-vs-newdesign-auth-gap.md), [ADR-015](../overview/tech-decisions.md).

> Tài liệu tham chiếu cho tất cả endpoints của **Auth Service** (`localhost:3004`).
> Service chịu trách nhiệm xác thực (authentication qua Identity Platform), phân quyền (authorization), và quản lý phiên đăng nhập (session whitelist).

> Liên quan: [Customer Endpoints](./customer-endpoints.md) · [Order Endpoints](./order-endpoints.md) · [Inventory Endpoints](./inventory-endpoints.md)

---

## Design notes (sau B1)

Các quyết định bảo mật đang áp dụng (xem [ADR-012](../overview/tech-decisions.md), [ADR-014](../overview/tech-decisions.md), [ADR-015](../overview/tech-decisions.md)):

- **Schema DB:** dùng `app_auth` (KHÔNG dùng `auth` của Supabase) — [ADR-014].
- **Identity:** không tự quản password (bcrypt đã gỡ). Xác thực qua **Identity Platform (Google sign-in)**; verify Firebase ID token bằng firebase-admin ở `/auth/sso/callback` — [ADR-015].
- **Session whitelist (revoke tức thì):** mỗi request gateway tra `session:<sid>` ở Redis (`getex`, slide TTL); logout xoá session; deactivation revoke toàn bộ session + `revokeRefreshTokens`. Đạt **FR-A13** + **FR-A9** — [ADR-015].
- **Authorization placement:** Gateway verify app token + authz thô theo role/route; mỗi service tự enforce authz mịn theo tài nguyên (ownership) — [ADR-012]. KHÔNG dồn toàn bộ check về Gateway.
- **Allowlist (interim):** chưa có Workspace domain → gate bằng email pre-provisioned trong `users` (KHÔNG theo `hd` domain). Forward path: lật sang restrict `hd` khi có Workspace domain — [ADR-015].

---

## Tổng quan

Auth Service dùng **Google sign-in qua Identity Platform (Firebase)** để xác thực, rồi phát **app access token** riêng và quản lý phiên qua **session whitelist**:

| Token / Phiên       | Mục đích                                   | Thời hạn |
| ------------------- | ------------------------------------------ | -------- |
| Firebase ID token   | Chứng minh Google identity ở `/auth/sso/callback` | ~1h (Firebase) |
| App access token (HS256) | Xác thực mỗi request (Bearer); mang `sid` | `APP_TOKEN_TTL` (mặc định 1h) |
| Session (`app_auth.sessions` + Redis `session:<sid>`) | Whitelist revoke tức thì + idle timeout | idle theo role (mặc định 30m, slide) |

### Luồng xác thực

```mermaid
sequenceDiagram
    participant Client
    participant Firebase as Identity Platform (Firebase)
    participant Gateway as API Gateway :3010
    participant Auth as Auth Service :3004
    participant Redis

    Client->>Firebase: signInWithPopup (Google)
    Firebase-->>Client: Firebase ID token
    Client->>Gateway: POST /auth/sso/callback { idToken }
    Gateway->>Auth: Forward (public)
    Auth->>Auth: verify ID token (firebase-admin) + allowlist email
    Auth->>Auth: link firebaseUid + INSERT app_auth.sessions
    Auth-->>Gateway: { accessToken (HS256, sid), user }
    Gateway-->>Client: 200 OK

    Client->>Gateway: GET /any-endpoint (Bearer app token)
    Gateway->>Gateway: verify HS256 signature
    Gateway->>Redis: getex session:<sid> (slide TTL)
    alt session hit
        Gateway->>Auth: Forward + x-user-*, x-user-sid
    else session miss
        Gateway-->>Client: 401 (logout / deactivation / idle)
    end
```

### Hệ thống phân quyền (RBAC)

| Role      | Mô tả                                      |
| --------- | ------------------------------------------- |
| `admin`   | Toàn quyền — quản lý user, dữ liệu, cấu hình |
| `manager` | Quản lý nghiệp vụ — CRUD customer, order, inventory |
| `staff`   | Nhân viên — tạo + xem, không được sửa/xóa   |

---

## Endpoints

### 1. `POST /auth/register` — Tạo user mới

Chỉ **admin** mới được phép tạo tài khoản. Đây là thiết kế có chủ đích — trong hệ thống ERP, không cho phép tự đăng ký tài khoản.

> **Sau B1 — password-less.** Không còn field `password`. Record `users` (email + role + fullName) chính là **entry allowlist**: user đăng nhập bằng Google sign-in với email khớp, `firebaseUid` được link ở lần đăng nhập đầu.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/register`     |
| **Auth**       | ✅ Required (Bearer) |
| **Role**       | `admin`              |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "email": "staff01@company.com",
  "fullName": "Nguyễn Văn A",
  "role": "staff"
}
```

| Field      | Type     | Required | Validation                          |
| ---------- | -------- | -------- | ----------------------------------- |
| `email`    | `string` | ✅       | Email hợp lệ, unique trong hệ thống |
| `fullName` | `string` | ✅       | Tối thiểu 2 ký tự                   |
| `role`     | `string` | ✅       | Một trong: `admin`, `manager`, `staff` |

#### Response — `201 Created`

```json
{
  "id": "uuid-abc-123",
  "email": "staff01@company.com",
  "fullName": "Nguyễn Văn A",
  "role": "staff"
}
```

| Field      | Type     | Mô tả                |
| ---------- | -------- | --------------------- |
| `id`       | `string` | UUID của user vừa tạo |
| `email`    | `string` | Email đã đăng ký      |
| `fullName` | `string` | Họ tên đầy đủ         |
| `role`     | `string` | Role được gán         |

#### Error Responses

| Status | Code              | Mô tả                                    |
| ------ | ----------------- | ----------------------------------------- |
| `400`  | `VALIDATION_ERROR`| Body thiếu field hoặc giá trị không hợp lệ |
| `401`  | `UNAUTHORIZED`    | Không có hoặc token không hợp lệ          |
| `403`  | `FORBIDDEN`       | User không phải admin                     |
| `409`  | `EMAIL_EXISTS`    | Email đã tồn tại trong hệ thống           |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "email": "staff01@company.com",
    "fullName": "Nguyễn Văn A",
    "role": "staff"
  }'
```

---

### 2. `POST /auth/sso/callback` — Đổi Firebase ID token lấy app token

Client đăng nhập bằng **"Sign in with Google"** (Firebase JS SDK `signInWithPopup`) rồi gửi Firebase **ID token** lên endpoint này. Server verify token (firebase-admin), **allowlist**-check email trong bảng `users` (chưa có Google Workspace domain → gate bằng email pre-provisioned, **KHÔNG** theo `hd` domain), link `firebaseUid` lần đăng nhập đầu, tạo session (`app_auth.sessions`) và trả **app access token**.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/sso/callback` |
| **Auth**       | ❌ Không cần (public) |
| **Role**       | Tất cả (email phải nằm trong allowlist) |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...(Firebase ID token)"
}
```

| Field     | Type     | Required | Validation                              |
| --------- | -------- | -------- | --------------------------------------- |
| `idToken` | `string` | ✅       | Firebase ID token hợp lệ (chưa hết hạn) |

#### Response — `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...(app token HS256)",
  "user": {
    "id": "uuid-abc-123",
    "email": "staff01@company.com",
    "role": "staff"
  }
}
```

| Field         | Type     | Mô tả                                                          |
| ------------- | -------- | -------------------------------------------------------------- |
| `accessToken` | `string` | App token HS256, payload có `sid`, TTL `APP_TOKEN_TTL` (mặc định 1h) |
| `user`        | `object` | Thông tin cơ bản của user (`id`, `email`, `role`)              |

#### Error Responses

| Status | Code               | Mô tả                                          |
| ------ | ------------------ | ----------------------------------------------- |
| `400`  | `VALIDATION_ERROR` | Body thiếu `idToken`                            |
| `401`  | `UNAUTHORIZED`     | Firebase ID token không hợp lệ / hết hạn        |
| `403`  | `FORBIDDEN`        | Email chưa được provision trong allowlist (`users`) |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/sso/callback \
  -H "Content-Type: application/json" \
  -d '{ "idToken": "<firebase_id_token>" }'
```

---

### 3. `POST /auth/logout` — Đăng xuất (revoke session)

Xoá session hiện tại khỏi whitelist → app token chết **tức thì** ở request kế (gateway tra `session:<sid>` miss → 401). Session được xác định qua header `x-user-sid` mà gateway bơm vào sau khi verify app token.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/logout`       |
| **Auth**       | ✅ Required (Bearer) |
| **Role**       | Tất cả               |
| **Content-Type** | Không cần body      |

#### Request

Không có body. Gateway bơm `x-user-sid` (session id) từ app token sau khi verify.

```
POST /auth/logout
Authorization: Bearer <app_access_token>
```

#### Response — `204 No Content`

Không có body.

#### Error Responses

| Status | Code           | Mô tả                            |
| ------ | -------------- | -------------------------------- |
| `401`  | `UNAUTHORIZED` | App token / session không hợp lệ |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/logout \
  -H "Authorization: Bearer <app_access_token>"
```

---

### 4. `GET /auth/me` — Thông tin user hiện tại

Trả về thông tin profile của user đang đăng nhập, được decode từ JWT payload + query database.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `GET`                |
| **Path**       | `/auth/me`           |
| **Auth**       | ✅ Required (Bearer) |
| **Role**       | Tất cả               |
| **Content-Type** | Không có body       |

#### Request

Không có request body. Chỉ cần gửi `Authorization` header.

```
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Response — `200 OK`

```json
{
  "id": "uuid-abc-123",
  "email": "staff01@company.com",
  "fullName": "Nguyễn Văn A",
  "role": "staff"
}
```

| Field      | Type     | Mô tả           |
| ---------- | -------- | ---------------- |
| `id`       | `string` | UUID của user    |
| `email`    | `string` | Email            |
| `fullName` | `string` | Họ tên đầy đủ   |
| `role`     | `string` | Role hiện tại    |

#### Error Responses

| Status | Code           | Mô tả                       |
| ------ | -------------- | ---------------------------- |
| `401`  | `UNAUTHORIZED` | Token không hợp lệ hoặc hết hạn |

#### cURL Example

```bash
curl -X GET http://localhost:3010/auth/me \
  -H "Authorization: Bearer <access_token>"
```

---

## Tổng hợp Endpoints

| #  | Method | Path                 | Auth | Role    | Mô tả                             |
| -- | ------ | -------------------- | ---- | ------- | --------------------------------- |
| 1  | POST   | `/auth/register`     | ✅   | admin   | Tạo user mới (password-less)      |
| 2  | POST   | `/auth/sso/callback` | ❌   | —       | Đổi Firebase ID token → app token |
| 3  | POST   | `/auth/logout`       | ✅   | all     | Đăng xuất (revoke session, 204)   |
| 4  | GET    | `/auth/me`           | ✅   | all     | Thông tin user hiện tại           |

---

## Ghi chú kỹ thuật

### Identity & App Token

Đăng nhập qua **Google sign-in** (Identity Platform / Firebase). Server verify Firebase ID token bằng **firebase-admin** — không tự quản password (bcrypt đã gỡ ở B1). Sau verify, auth-service phát **app access token HS256** chứa `sid` (session id), TTL `APP_TOKEN_TTL` (mặc định 1h).

### Session Whitelist (revoke tức thì)

Mỗi session = 1 row `app_auth.sessions(id, user_id, started_at, expires_at, ip, user_agent)` + key `session:<sid>` ở Redis (Upstash). Gateway tra `getex session:<sid>` mỗi request (đọc + slide TTL = idle timeout). Miss → 401. `POST /auth/logout` xoá session; deactivate user (`isActive:false`) revoke **toàn bộ** session của user + `revokeRefreshTokens` (Firebase). Đây là lớp đạt **FR-A13** (revoke tức thì) + **FR-A9** (idle timeout theo role, mặc định 30m).

### Luồng xử lý lỗi Authentication

```mermaid
flowchart TD
    A["Request đến API Gateway"] --> B{"Có Authorization header?"}
    B -- Không --> C["401 UNAUTHORIZED"]
    B -- Có --> D{"Chữ ký app token HS256 hợp lệ?"}
    D -- Không --> C
    D -- Có --> E{"session còn trong Redis (getex)?"}
    E -- Không --> C
    E -- Có --> F{"Role đủ quyền?"}
    F -- Không --> G["403 FORBIDDEN"]
    F -- Có --> H["Cho phép truy cập"]
```

---

## Manual E2E Verification (B1)

> ⚙️ **Thủ công** — cần Identity Platform (hoặc Firebase Auth emulator) + Redis + Postgres đang chạy, và ≥1 user đã provision trong allowlist (`app_auth.users`). Chưa tự động hoá.

1. **Sign in với Google** ở frontend (`signInWithPopup`) → lấy Firebase ID token → `POST /auth/sso/callback` trả `{ accessToken, user }` (**200**).
2. **Gọi endpoint được bảo vệ** với `Authorization: Bearer <accessToken>` (vd `GET /auth/me`) → **200**.
3. **`POST /auth/logout`** → **204**. Gọi lại bước 2 với **cùng token** → **401 trong vài giây** (session bị xoá khỏi whitelist).
4. **Idle timeout**: để token không dùng quá idle (`getex` không slide, mặc định 30m) → request kế **401** (Redis `session:<sid>` hết hạn).
5. **Deactivation**: admin set `isActive:false` cho user khác → mọi token đang sống của user đó → **401 tức thì** (toàn bộ session revoke).

Kỳ vọng: bước 3 và 5 đóng **FR-A13**; bước 4 đóng **FR-A9**.

---

Liên quan: [Customer Endpoints](./customer-endpoints.md) · [Order Endpoints](./order-endpoints.md) · [Inventory Endpoints](./inventory-endpoints.md) · [Getting Started](../development/getting-started.md)
