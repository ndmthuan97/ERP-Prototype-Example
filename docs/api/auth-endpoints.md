# Auth Service — API Endpoints

> Tài liệu tham chiếu cho tất cả endpoints của **Auth Service** (`localhost:3004`).
> Service chịu trách nhiệm xác thực (authentication), phân quyền (authorization), và quản lý phiên đăng nhập (session) thông qua JWT.

> Liên quan: [Customer Endpoints](./customer-endpoints.md) · [Order Endpoints](./order-endpoints.md) · [Inventory Endpoints](./inventory-endpoints.md)

---

## Tổng quan

Auth Service sử dụng cơ chế **bcrypt + JWT** tự xây dựng (không dùng Passport.js hay third-party auth provider). Hệ thống phát hành cặp token:

| Token          | Mục đích                        | Thời hạn   |
| -------------- | ------------------------------- | ---------- |
| `accessToken`  | Xác thực mỗi request (Bearer)  | Ngắn hạn   |
| `refreshToken` | Gia hạn accessToken khi hết hạn | Dài hạn    |

### Luồng xác thực

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway :3010
    participant Auth as Auth Service :3004

    Client->>Gateway: POST /auth/login
    Gateway->>Auth: Forward request
    Auth->>Auth: Verify email + bcrypt password
    Auth-->>Gateway: {accessToken, refreshToken, user}
    Gateway-->>Client: 200 OK

    Client->>Gateway: GET /any-endpoint (Bearer token)
    Gateway->>Auth: Validate token
    Auth-->>Gateway: User payload
    Gateway->>Gateway: Check RBAC role
    Gateway-->>Client: Response data
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
  "password": "SecureP@ss123",
  "fullName": "Nguyễn Văn A",
  "role": "staff"
}
```

| Field      | Type     | Required | Validation                          |
| ---------- | -------- | -------- | ----------------------------------- |
| `email`    | `string` | ✅       | Email hợp lệ, unique trong hệ thống |
| `password` | `string` | ✅       | Tối thiểu 8 ký tự                   |
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
    "password": "SecureP@ss123",
    "fullName": "Nguyễn Văn A",
    "role": "staff"
  }'
```

---

### 2. `POST /auth/login` — Đăng nhập

Xác thực bằng email + password, trả về cặp token (access + refresh) cùng thông tin user cơ bản.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/login`        |
| **Auth**       | ❌ Không cần         |
| **Role**       | Tất cả               |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "email": "staff01@company.com",
  "password": "SecureP@ss123"
}
```

| Field      | Type     | Required | Validation          |
| ---------- | -------- | -------- | ------------------- |
| `email`    | `string` | ✅       | Email hợp lệ        |
| `password` | `string` | ✅       | Không được để trống  |

#### Response — `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-abc-123",
    "email": "staff01@company.com",
    "role": "staff"
  }
}
```

| Field          | Type     | Mô tả                            |
| -------------- | -------- | --------------------------------- |
| `accessToken`  | `string` | JWT để xác thực các request tiếp theo |
| `refreshToken` | `string` | JWT để gia hạn khi accessToken hết hạn |
| `user`         | `object` | Thông tin cơ bản của user         |
| `user.id`      | `string` | UUID                              |
| `user.email`   | `string` | Email                             |
| `user.role`    | `string` | Role: admin / manager / staff     |

#### Error Responses

| Status | Code                  | Mô tả                            |
| ------ | --------------------- | --------------------------------- |
| `400`  | `VALIDATION_ERROR`    | Body thiếu field hoặc không hợp lệ |
| `401`  | `INVALID_CREDENTIALS` | Email hoặc password không đúng    |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff01@company.com",
    "password": "SecureP@ss123"
  }'
```

---

### 3. `POST /auth/refresh` — Gia hạn token

Dùng `refreshToken` còn hiệu lực để nhận cặp token mới. Sau khi refresh thành công, refreshToken cũ sẽ bị **vô hiệu hóa** (rotation strategy) để chống replay attack.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/refresh`      |
| **Auth**       | ❌ Không cần Bearer  |
| **Role**       | Tất cả               |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Field          | Type     | Required | Validation                 |
| -------------- | -------- | -------- | -------------------------- |
| `refreshToken` | `string` | ✅       | JWT refresh token hợp lệ  |

#### Response — `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...(new)",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...(new)"
}
```

| Field          | Type     | Mô tả               |
| -------------- | -------- | -------------------- |
| `accessToken`  | `string` | Access token mới     |
| `refreshToken` | `string` | Refresh token mới    |

#### Error Responses

| Status | Code                    | Mô tả                                  |
| ------ | ----------------------- | --------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Body thiếu refreshToken                 |
| `401`  | `INVALID_REFRESH_TOKEN` | Token hết hạn, không tồn tại, hoặc đã bị revoke |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

---

### 4. `POST /auth/logout` — Đăng xuất

Vô hiệu hóa refreshToken. AccessToken vẫn còn hiệu lực cho đến khi hết hạn tự nhiên (stateless JWT). RefreshToken bị thêm vào blacklist trên Redis.

| Thuộc tính     | Giá trị              |
| -------------- | -------------------- |
| **Method**     | `POST`               |
| **Path**       | `/auth/logout`       |
| **Auth**       | ✅ Required (Bearer) |
| **Role**       | Tất cả               |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Field          | Type     | Required | Validation                |
| -------------- | -------- | -------- | ------------------------- |
| `refreshToken` | `string` | ✅       | Refresh token cần revoke  |

#### Response — `200 OK`

```json
{
  "message": "Logged out successfully"
}
```

#### Error Responses

| Status | Code               | Mô tả                          |
| ------ | ------------------ | ------------------------------- |
| `400`  | `VALIDATION_ERROR` | Body thiếu refreshToken         |
| `401`  | `UNAUTHORIZED`     | Access token không hợp lệ       |

#### cURL Example

```bash
curl -X POST http://localhost:3010/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

---

### 5. `GET /auth/me` — Thông tin user hiện tại

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

| #  | Method | Path             | Auth | Role    | Mô tả                  |
| -- | ------ | ---------------- | ---- | ------- | ----------------------- |
| 1  | POST   | `/auth/register` | ✅   | admin   | Tạo user mới            |
| 2  | POST   | `/auth/login`    | ❌   | —       | Đăng nhập               |
| 3  | POST   | `/auth/refresh`  | ❌   | —       | Gia hạn token           |
| 4  | POST   | `/auth/logout`   | ✅   | all     | Đăng xuất               |
| 5  | GET    | `/auth/me`       | ✅   | all     | Thông tin user hiện tại |

---

## Ghi chú kỹ thuật

### Password Hashing

Password được hash bằng **bcrypt** với salt rounds mặc định (10). Không bao giờ lưu plain-text password vào database.

### Token Blacklist

Khi user logout hoặc refresh token, refreshToken cũ được thêm vào **Redis blacklist** (Upstash Redis). TTL của key trên Redis bằng thời gian còn lại của token → tự dọn dẹp.

### Luồng xử lý lỗi Authentication

```mermaid
flowchart TD
    A["Request đến API Gateway"] --> B{"Có Authorization header?"}
    B -- Không --> C["401 UNAUTHORIZED"]
    B -- Có --> D{"Token hợp lệ?"}
    D -- Không --> C
    D -- Có --> E{"Token hết hạn?"}
    E -- Có --> C
    E -- Không --> F{"Role đủ quyền?"}
    F -- Không --> G["403 FORBIDDEN"]
    F -- Có --> H["Cho phép truy cập"]
```

---

Liên quan: [Customer Endpoints](./customer-endpoints.md) · [Order Endpoints](./order-endpoints.md) · [Inventory Endpoints](./inventory-endpoints.md) · [Getting Started](../development/getting-started.md)
