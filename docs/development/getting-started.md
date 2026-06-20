# Getting Started — Hướng dẫn cài đặt và chạy dự án

> Hướng dẫn từng bước để cài đặt môi trường phát triển, cấu hình services, và chạy toàn bộ hệ thống ERP prototype trên máy local.
> Thời gian ước tính: **30-45 phút** cho lần đầu tiên.

> Liên quan: [Coding Standards](./coding-standards.md) · [Auth Endpoints](../api/auth-endpoints.md)

> ⚠️ **Trạng thái thực tế:** hiện **chỉ `customer-service` chạy được**. Các mục về `auth/order/inventory/api-gateway` (§6) và `frontend` (§7), seed admin (§9) là **blueprint cho tương lai** — đánh dấu 🚧 bên dưới, bỏ qua cho tới khi service đó được build. Xem [Implementation Status](../IMPLEMENTATION-STATUS.md).
>
> **Đường nhanh chỉ chạy customer-service:** §1 → §2 → §3 → §4 (chỉ cần schema `customer`) → §5 → §6 (chỉ phần Customer Service) → §8 (chỉ health 3001).

---

## 1. Prerequisites — Phần mềm cần cài đặt

Trước khi bắt đầu, đảm bảo máy đã cài đặt đầy đủ các phần mềm sau:

| Phần mềm          | Version tối thiểu | Kiểm tra                    | Mục đích                          |
| ------------------ | ----------------- | ---------------------------- | --------------------------------- |
| **Node.js**        | >= 20.x           | `node --version`             | Runtime cho NestJS + Next.js      |
| **npm**            | >= 10.x           | `npm --version`              | Package manager                   |
| **Docker Desktop** | Latest            | `docker --version`           | Chạy GCP Pub/Sub Emulator        |
| **Git**            | Latest            | `git --version`              | Version control                   |
| **VS Code**        | Latest            | —                            | Code editor (khuyến nghị)         |

### VS Code Extensions khuyến nghị

| Extension                  | Mục đích                          |
| -------------------------- | --------------------------------- |
| Prisma                     | Syntax highlighting cho schema    |
| ESLint                     | Linting JavaScript/TypeScript     |
| Prettier                   | Code formatting                   |
| REST Client                | Test API trực tiếp trong VS Code  |
| Docker                     | Quản lý containers                |
| Tailwind CSS IntelliSense  | Autocomplete cho Tailwind         |

---

## 2. Tạo tài khoản dịch vụ bên ngoài

Hệ thống sử dụng 2 dịch vụ cloud (free tier đủ dùng cho development):

### 2.1 Supabase (PostgreSQL)

1. Truy cập [supabase.com](https://supabase.com) → **Sign up** (dùng GitHub)
2. Tạo **New Project** → chọn region gần nhất (Singapore)
3. Lưu lại thông tin:
   - **Project URL**: `https://xxx.supabase.co`
   - **Database Password**: password khi tạo project
   - **Connection String**: `Settings → Database → Connection string → URI`

### 2.2 Upstash (Redis)

1. Truy cập [upstash.com](https://upstash.com) → **Sign up**
2. Tạo **New Database** → chọn region gần nhất
3. Lưu lại thông tin:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

---

## 3. Clone repo và cấu hình môi trường

### 3.1 Clone repository

```bash
git clone <repository-url> erp-prototype-example
cd erp-prototype-example
```

### 3.2 Cấu trúc thư mục tổng quan

```
erp-prototype-example/
├── backend/
│   ├── auth-service/          # :3004
│   ├── customer-service/      # :3001
│   ├── order-service/         # :3002
│   ├── inventory-service/     # :3003
│   ├── api-gateway/           # :3010
│   └── docker-compose.yml     # Pub/Sub Emulator
├── frontend/                  # Next.js :3000
├── docs/
└── README.md
```

### 3.3 Cấu hình `.env`

> Hiện có **1 file `.env` duy nhất ở `backend/`** (không phải mỗi service 1 file). Copy và điền giá trị thực:

```bash
cp backend/.env.example backend/.env
# Mở backend/.env và điền giá trị
```

#### Bảng biến môi trường chung (theo `backend/.env.example` thật)

| Biến                         | Mô tả                              | Ví dụ                                    |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| `DATABASE_URL`               | Connection pooled (PgBouncer, 6543) — dùng cho runtime | `postgresql://postgres.[ref]:pass@...pooler.supabase.com:6543/postgres` |
| `DIRECT_URL`                 | Connection direct (5432) — dùng cho `prisma migrate`/`db push` | `postgresql://postgres.[ref]:pass@db.[ref].supabase.co:5432/postgres` |
| `JWT_SECRET`                 | Secret key cho JWT (auth-service tương lai) | `your-super-secret-key-min-32-chars`     |
| `JWT_EXPIRES_IN`             | Thời hạn access token               | `15m`                                    |
| `JWT_REFRESH_EXPIRES_IN`     | Thời hạn refresh token              | `7d`                                     |
| `UPSTASH_REDIS_REST_URL`     | Upstash Redis URL                   | `https://xxx.upstash.io`                 |
| `UPSTASH_REDIS_REST_TOKEN`   | Upstash Redis token                 | `AXxx...`                                |
| `PUBSUB_EMULATOR_HOST`      | Pub/Sub Emulator host               | `localhost:8085`                          |
| `PUBSUB_PROJECT_ID`         | GCP project ID (giả lập)            | `erp-prototype`                          |

> **Schema per service:** mỗi service quản lý 1 schema riêng (`customer`, `order`, `inventory`, ...) qua Prisma `schemas` trong `schema.prisma` — **không** truyền `?schema=` trên connection string. Hiện chỉ schema `customer` tồn tại.

---

## 4. Tạo Database Schemas trên Supabase

Truy cập **Supabase Dashboard → SQL Editor** và chạy lệnh sau:

```sql
-- Tạo 4 schemas riêng biệt cho mỗi service (Bounded Context)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS "order";       -- "order" là reserved keyword, cần quotes
CREATE SCHEMA IF NOT EXISTS inventory;
```

> **Tại sao dùng schemas riêng?** Đây là cách mô phỏng "database per service" trong microservices mà không cần nhiều database instances. Mỗi service chỉ được phép truy cập schema của mình — tuân thủ nguyên tắc **Bounded Context** trong DDD.

### Kiểm tra schemas đã tạo

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('auth', 'customer', 'order', 'inventory');
```

Kết quả mong đợi: 4 rows.

---

## 5. Khởi động GCP Pub/Sub Emulator

Pub/Sub Emulator chạy trong Docker, dùng cho event-driven communication giữa các services.

```bash
cd backend
docker compose up -d
```

### Kiểm tra Emulator đang chạy

```bash
docker compose ps
```

```
NAME                  STATUS
pubsub-emulator       Up (healthy)
```

Hoặc kiểm tra trực tiếp:

```bash
curl http://localhost:8085
```

> **Lưu ý**: Emulator không lưu dữ liệu giữa các lần restart. Topics và subscriptions sẽ được các services tự tạo khi khởi động.

---

## 6. Install, Migrate, và Start mỗi Service

### Thứ tự khởi động

Khởi động theo thứ tự để đảm bảo dependencies:

```mermaid
flowchart LR
    A["1. Pub/Sub Emulator"] --> B["2. Auth Service :3004"]
    B --> C["3. Customer Service :3001"]
    B --> D["4. Order Service :3002"]
    B --> E["5. Inventory Service :3003"]
    C --> F["6. API Gateway :3010"]
    D --> F
    E --> F
    F --> G["7. Frontend :3000"]
```

### Lệnh cho mỗi service

Mở **terminal riêng** cho mỗi service:

> **Prerequisite (1 lần):** build thư viện dùng chung trước khi start service.
> ```bash
> cd backend
> npm run install:shared && npm run build:shared
> ```

#### Customer Service ✅ (chạy được)

```bash
cd backend/customer-service
npm install
npx prisma generate
npx prisma db push           # Tạo bảng + index trong schema "customer"
npm run start:dev            # KHÔNG phải "npm run dev"
```

> Tùy chọn (tối ưu tìm kiếm tên KH khi data lớn): tạo trigram GIN index —
> `psql "$DIRECT_URL" -f prisma/sql/search-index.sql` (hoặc dán vào Supabase SQL Editor).

#### Inventory Service ✅ (chạy được)

```bash
cd backend/inventory-service
npm install
npx prisma generate
npx prisma db push           # Tạo bảng trong schema "inventory"
npm run start:dev            # Port 3003
```

> Optimistic locking demo: `POST /inventory/items` → `POST /inventory/items/:sku/reserve`
> (nhiều request reserve đồng thời 1 SKU không gây lost update — xem `test:int`).

#### Auth / Order / API Gateway 🚧 (chưa implement — bỏ qua)

Các service này hiện chỉ là scaffold `Hello World!` (chưa có Prisma schema, business logic). Lệnh `prisma db push` sẽ lỗi vì chưa có `schema.prisma`. **Bỏ qua** cho tới khi được build theo [improvement-plan.md](../../improvement-plan.md) (Track C) / [prototype-development-plan.md](../../prototype-development-plan.md).

### Bảng ports tổng hợp

| Service            | Port   | URL                         |
| ------------------ | ------ | --------------------------- |
| Customer Service   | `3001` | `http://localhost:3001`     |
| Order Service      | `3002` | `http://localhost:3002`     |
| Inventory Service  | `3003` | `http://localhost:3003`     |
| Auth Service       | `3004` | `http://localhost:3004`     |
| API Gateway        | `3010` | `http://localhost:3010`     |
| Frontend           | `3000` | `http://localhost:3000`     |
| Pub/Sub Emulator   | `8085` | `http://localhost:8085`     |

---

## 7. Khởi động Frontend 🚧 (chưa implement)

> Thư mục `frontend/` hiện **rỗng** — chưa có `package.json` hay code. Bỏ qua mục này. Lệnh dưới là blueprint cho khi frontend được build (Next.js 15 + Ant Design 5).

```bash
cd frontend
npm install
npm run dev
```

Truy cập `http://localhost:3000` để mở giao diện.

### Tech Stack Frontend

| Công nghệ         | Mục đích                         |
| ------------------ | -------------------------------- |
| **Next.js 15**     | React framework (App Router)     |
| **Ant Design 5**   | UI component library             |
| **Tailwind CSS**   | Utility-first CSS                |

---

## 8. Verify — Kiểm tra hệ thống hoạt động

### Health Check các services

> Hiện chỉ `customer-service:3001` trả health thật. Các service khác (3002/3003/3004/3010) chưa chạy — 🚧 blueprint.

```bash
# Customer Service ✅
curl http://localhost:3001/health
# Expected: {"status":"ok","time":...,"checks":[{"name":"postgres",...},{"name":"redis",...}]}

# --- 🚧 các service dưới đây CHƯA implement ---
# Auth Service
curl http://localhost:3004/health
# Expected: {"status":"ok"}

# Order Service
curl http://localhost:3002/health
# Expected: {"status":"ok"}

# Inventory Service
curl http://localhost:3003/health
# Expected: {"status":"ok"}

# API Gateway
curl http://localhost:3010/health
# Expected: {"status":"ok"}
```

### Bảng checklist

| #  | Kiểm tra                    | Kết quả mong đợi       | ✅ |
| -- | --------------------------- | ----------------------- | -- |
| 1  | Docker Pub/Sub running      | Container status: Up    |    |
| 2  | Auth Service health         | `{"status":"ok"}`       |    |
| 3  | Customer Service health     | `{"status":"ok"}`       |    |
| 4  | Order Service health        | `{"status":"ok"}`       |    |
| 5  | Inventory Service health    | `{"status":"ok"}`       |    |
| 6  | API Gateway health          | `{"status":"ok"}`       |    |
| 7  | Frontend accessible         | Trang login hiển thị    |    |

---

## 9. Seed — Tạo admin user đầu tiên 🚧 (chưa implement)

> Mục này phụ thuộc `auth-service` (chưa code): chưa có schema `auth`, bảng `auth.users`, file `prisma/seed.ts`, hay script `seed/create-admin.js`. **Bỏ qua** cho tới khi auth-service được build. Lưu ý blueprint sẽ đổi schema `auth` (reserved của Supabase) → `app_auth`.

Vì endpoint `POST /auth/register` yêu cầu admin token, bạn cần seed admin user trực tiếp vào database lần đầu tiên.

### Cách 1: Dùng Seed Script (khuyến nghị)

```bash
cd backend/auth-service
npx ts-node prisma/seed.ts
```

### Cách 2: Insert trực tiếp qua SQL

Truy cập **Supabase SQL Editor** và chạy:

```sql
-- Password: Admin@123 (đã hash bằng bcrypt, 10 salt rounds)
INSERT INTO auth.users (id, email, password_hash, full_name, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@company.com',
  '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',  -- Thay bằng hash thật
  'System Admin',
  'admin',
  NOW(),
  NOW()
);
```

> **Cách lấy bcrypt hash**: Chạy lệnh sau trong Node.js REPL:
> ```bash
> node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin@123', 10).then(h => console.log(h))"
> ```

### Kiểm tra đăng nhập

```bash
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "Admin@123"
  }'
```

Kết quả mong đợi:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid-...",
    "email": "admin@company.com",
    "role": "admin"
  }
}
```

---

## Xử lý sự cố thường gặp

| Lỗi                                     | Nguyên nhân                        | Giải pháp                              |
| ---------------------------------------- | ---------------------------------- | -------------------------------------- |
| `ECONNREFUSED :5432`                     | Database connection bị từ chối     | Kiểm tra DATABASE_URL trong .env       |
| `P1001: Can't reach database`            | Prisma không kết nối được DB       | Kiểm tra IP whitelist trên Supabase    |
| `ECONNREFUSED :8085`                     | Pub/Sub Emulator chưa chạy        | `cd backend && docker compose up -d`   |
| `JWT_SECRET not defined`                 | Thiếu biến môi trường              | Kiểm tra file .env đã copy và điền     |
| `Port already in use`                    | Port đang bị chiếm bởi process khác| `npx kill-port 3001` (thay port tương ứng) |
| `Schema "order" does not exist`          | Chưa tạo schemas trên Supabase    | Chạy lại SQL ở bước 4                  |
| `prisma generate` lỗi                    | schema.prisma syntax error         | Kiểm tra Prisma schema file            |

---

Liên quan: [Coding Standards](./coding-standards.md) · [Auth Endpoints](../api/auth-endpoints.md) · [Customer Endpoints](../api/customer-endpoints.md) · [Order Endpoints](../api/order-endpoints.md) · [Inventory Endpoints](../api/inventory-endpoints.md)
