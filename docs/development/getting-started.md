---
type: Runbook
title: "Getting Started — Setup Guide"
description: "Step-by-step guide to install prerequisites, configure services, and run the full ERP system locally"
tags: [runbook, setup, development, getting-started]
timestamp: "2026-06-27T09:15:00+07:00"
---

# Getting Started — Hướng dẫn cài đặt và chạy dự án

> Hướng dẫn từng bước để cài đặt môi trường phát triển, cấu hình services, và chạy toàn bộ hệ thống ERP prototype trên máy local.
> Thời gian ước tính: **30-45 phút** cho lần đầu tiên, **< 1 phút** cho các lần sau.

> Liên quan: [Coding Standards](./coding-standards.md) · [Auth Endpoints](../api/auth-endpoints.md)

> [!NOTE]
> **Kiến trúc chạy local:** Docker **chỉ dùng cho Pub/Sub Emulator**. PostgreSQL (Supabase) và Redis (Upstash) chạy trên cloud. Tất cả 6 backend services + API Gateway chạy trực tiếp trên terminal bằng **một lệnh duy nhất** với hot-reload.

---

## TL;DR — Chạy nhanh

Nếu đã setup đầy đủ (`.env`, schemas, Docker), chỉ cần:

```bash
# Docker — Pub/Sub Emulator
cd backend && docker compose up -d

# Terminal — Tất cả 6 services hot-reload
npm run dev:all
```

Frontend (terminal riêng):

```bash
cd frontend && npm run dev
```

---

## 1. Prerequisites — Phần mềm cần cài đặt

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
│   ├── shared/                 # @erp/shared — cache, messaging, observability
│   ├── docker-compose.yml      # Pub/Sub Emulator (Docker container DUY NHẤT)
│   ├── auth-service/           # :3004
│   ├── customer-service/       # :3001
│   ├── sales-service/          # :3002
│   ├── inventory-service/      # :3003
│   ├── catalog-service/        # :3005
│   ├── purchasing-service/     # :3006
│   └── api-gateway/            # :3010
├── frontend/                   # Next.js :3000
├── docs/
└── README.md
```

### 3.3 Cấu hình `.env`

> Có **1 file `.env` duy nhất ở `backend/`** — tất cả services đọc chung file này. Copy và điền giá trị thực:

```bash
cp backend/.env.example backend/.env
# Mở backend/.env và điền giá trị
```

#### Bảng biến môi trường

| Biến                         | Mô tả                              | Ví dụ                                    |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| `DATABASE_URL`               | Connection pooled (PgBouncer, 6543) — dùng cho runtime | `postgresql://postgres.[ref]:pass@...pooler.supabase.com:6543/postgres` |
| `DIRECT_URL`                 | Connection direct (5432) — dùng cho `prisma migrate`/`db push` | `postgresql://postgres.[ref]:pass@db.[ref].supabase.co:5432/postgres` |
| `JWT_SECRET`                 | Secret key cho JWT                  | `your-super-secret-key-min-32-chars`     |
| `JWT_EXPIRES_IN`             | Thời hạn access token               | `15m`                                    |
| `JWT_REFRESH_EXPIRES_IN`     | Thời hạn refresh token              | `7d`                                     |
| `UPSTASH_REDIS_REST_URL`     | Upstash Redis URL                   | `https://xxx.upstash.io`                 |
| `UPSTASH_REDIS_REST_TOKEN`   | Upstash Redis token                 | `AXxx...`                                |
| `PUBSUB_EMULATOR_HOST`      | Pub/Sub Emulator host               | `localhost:8085`                          |
| `PUBSUB_PROJECT_ID`         | GCP project ID (giả lập)            | `erp-prototype`                          |

> **Schema per service:** mỗi service quản lý 1 Prisma schema riêng (`auth`, `customer`, `sales`, `inventory`, `catalog`, `purchasing`) — **không** truyền `?schema=` trên connection string.

---

## 4. Tạo Database Schemas trên Supabase

Truy cập **Supabase Dashboard → SQL Editor** và chạy lệnh sau:

```sql
-- Tạo schemas riêng biệt cho mỗi service (Bounded Context)
CREATE SCHEMA IF NOT EXISTS app_auth;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS purchasing;
```

> **Tại sao dùng schemas riêng?** Đây là cách mô phỏng "database per service" trong microservices mà không cần nhiều database instances. Mỗi service chỉ được phép truy cập schema của mình — tuân thủ nguyên tắc **Bounded Context** trong DDD.

### Kiểm tra schemas đã tạo

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('app_auth', 'customer', 'sales', 'inventory', 'catalog', 'purchasing');
```

Kết quả mong đợi: 6 rows.

---

## 5. Khởi động GCP Pub/Sub Emulator (Docker)

> [!IMPORTANT]
> Đây là **container Docker duy nhất** cần chạy. Tất cả các services khác chạy trực tiếp trên terminal.

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
pubsub-emulator       Up
```

Hoặc kiểm tra trực tiếp:

```bash
curl http://localhost:8085
```

> Emulator không lưu dữ liệu giữa các lần restart. Topics và subscriptions sẽ được các services tự tạo khi khởi động.

### Lệnh Docker thường dùng

| Lệnh                         | Mô tả                    |
| ----------------------------- | ------------------------- |
| `docker compose up -d`        | Khởi động (background)    |
| `docker compose down`         | Dừng và xóa container     |
| `docker compose logs -f`      | Xem logs real-time        |
| `docker compose restart`      | Restart container          |

---

## 6. Cài đặt và chạy Backend (Terminal)

> [!NOTE]
> Tất cả lệnh chạy từ thư mục `backend/`. Mỗi service có `node_modules` độc lập (không dùng npm workspaces vì Prisma Client conflict).

### Lần đầu (hoặc khi thêm dependency mới)

```bash
cd backend

# 1. Install tất cả dependencies (shared + 6 services)
npm run install:all

# 2. Build thư viện dùng chung @erp/shared
npm run build:shared

# 3. Generate Prisma Client cho tất cả services
npm run prisma:all
```

> [!TIP]
> Nếu lần đầu push schema lên Supabase, chạy thêm `npx prisma db push` trong từng service có schema thay đổi. Ví dụ:
> ```bash
> cd customer-service && npx prisma db push && cd ..
> ```

### Chạy dev hàng ngày — 1 lệnh duy nhất

```bash
cd backend
npm run dev:all
```

Lệnh `dev:all` sử dụng `concurrently` để khởi động **tất cả 6 services** đồng thời với hot-reload:

| Service            | Port   | Script tương ứng         |
| ------------------ | ------ | ------------------------ |
| Customer Service   | `3001` | `npm run dev:customer`   |
| Sales Service      | `3002` | `npm run dev:sales`      |
| Inventory Service  | `3003` | `npm run dev:inventory`  |
| Auth Service       | `3004` | `npm run dev:auth`       |
| Catalog Service    | `3005` | `npm run dev:catalog`    |
| Purchasing Service | `3006` | `npm run dev:purchasing` |

> Nếu chỉ cần chạy **1 service cụ thể** (ví dụ debug riêng), dùng lệnh tương ứng:
> ```bash
> npm run dev:customer    # chỉ Customer Service :3001
> ```

### Thứ tự khởi động (nội bộ)

```mermaid
flowchart LR
    A["1. Pub/Sub Emulator (Docker)"] --> B["2. dev:all (6 services)"]
    B --> C["3. Frontend :3000"]
```

> `dev:all` khởi động tất cả services song song — không cần quan tâm thứ tự giữa các services vì mỗi service tự retry kết nối Pub/Sub khi sẵn sàng.

---

## 7. Khởi động Frontend

> Frontend build bằng Next.js 15 + Ant Design 5, 9 pages, responsive sidebar, full API coverage.

```bash
cd frontend
npm install       # lần đầu
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

### Bảng ports tổng hợp

| Service            | Port   | URL                         |
| ------------------ | ------ | --------------------------- |
| Frontend           | `3000` | `http://localhost:3000`     |
| Customer Service   | `3001` | `http://localhost:3001`     |
| Sales Service      | `3002` | `http://localhost:3002`     |
| Inventory Service  | `3003` | `http://localhost:3003`     |
| Auth Service       | `3004` | `http://localhost:3004`     |
| Catalog Service    | `3005` | `http://localhost:3005`     |
| Purchasing Service | `3006` | `http://localhost:3006`     |
| API Gateway        | `3010` | `http://localhost:3010`     |
| Pub/Sub Emulator   | `8085` | `http://localhost:8085`     |

### Health Check các services

```bash
# API Gateway (tổng hợp)
curl http://localhost:3010/health

# Từng service
curl http://localhost:3001/health   # Customer
curl http://localhost:3002/health   # Sales
curl http://localhost:3003/health   # Inventory
curl http://localhost:3004/health   # Auth
curl http://localhost:3005/health   # Catalog
curl http://localhost:3006/health   # Purchasing
```

### Checklist

| #  | Kiểm tra                    | Kết quả mong đợi       | ✅ |
| -- | --------------------------- | ----------------------- | -- |
| 1  | Docker Pub/Sub running      | Container status: Up    |    |
| 2  | Auth Service health         | `{"status":"ok"}`       |    |
| 3  | Customer Service health     | `{"status":"ok"}`       |    |
| 4  | Sales Service health        | `{"status":"ok"}`       |    |
| 5  | Inventory Service health    | `{"status":"ok"}`       |    |
| 6  | Catalog Service health      | `{"status":"ok"}`       |    |
| 7  | Purchasing Service health   | `{"status":"ok"}`       |    |
| 8  | API Gateway health          | `{"status":"ok"}`       |    |
| 9  | Frontend accessible         | Trang login hiển thị    |    |

---

## 9. Seed — Tạo admin user đầu tiên

> Auth-service đã implement đầy đủ. Schema `app_auth` với bảng `users` và `refresh_tokens` đã chạy.

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

## Quy trình hàng ngày (tóm tắt)

Sau khi đã setup xong, mỗi ngày chỉ cần:

```bash
# Terminal 1 — Pub/Sub Emulator (nếu chưa chạy)
cd backend && docker compose up -d

# Terminal 2 — Tất cả 6 backend services
cd backend && npm run dev:all

# Terminal 3 — Frontend
cd frontend && npm run dev
```

> [!TIP]
> Nếu chỉ cần làm việc với 1-2 services, thay `dev:all` bằng lệnh cụ thể:
> ```bash
> npm run dev:customer     # chỉ Customer :3001
> npm run dev:sales        # chỉ Sales :3002
> ```

---

## Xử lý sự cố thường gặp

| Lỗi                                     | Nguyên nhân                        | Giải pháp                              |
| ---------------------------------------- | ---------------------------------- | -------------------------------------- |
| `ECONNREFUSED :5432`                     | Database connection bị từ chối     | Kiểm tra `DATABASE_URL` trong `.env`   |
| `P1001: Can't reach database`            | Prisma không kết nối được DB       | Kiểm tra IP whitelist trên Supabase    |
| `ECONNREFUSED :8085`                     | Pub/Sub Emulator chưa chạy        | `cd backend && docker compose up -d`   |
| `JWT_SECRET not defined`                 | Thiếu biến môi trường              | Kiểm tra file `.env` đã copy và điền   |
| `Port already in use`                    | Port đang bị chiếm                 | `npx kill-port 3001` (thay port)       |
| `Schema "X" does not exist`             | Chưa tạo schemas trên Supabase    | Chạy lại SQL ở §4                      |
| `prisma generate` lỗi                    | `schema.prisma` syntax error       | Kiểm tra Prisma schema file            |
| `@erp/shared` not found                 | Chưa build shared lib              | `npm run build:shared`                 |
| `concurrently: command not found`        | Chưa install root dependencies     | `cd backend && npm install`            |

---

## Related Concepts

- [Coding Standards](./coding-standards.md)
- [Auth Endpoints](../api/auth-endpoints.md)
- [Customer Endpoints](../api/customer-endpoints.md)
- [Sales Endpoints](../api/order-endpoints.md)
- [Inventory Endpoints](../api/inventory-endpoints.md)
- [Catalog Endpoints](../api/catalog-endpoints.md)
- [Purchasing Endpoints](../api/purchasing-endpoints.md)
