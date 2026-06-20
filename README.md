# ERP Prototype Example

> Prototype validate kiến trúc microservices: DDD, Event-driven, CQRS, Outbox, Saga, Aggregate Root.

> ⚠️ **Trạng thái:** đây là learning project đang ở giai đoạn đầu. **Hiện chỉ `customer-service` + thư viện `@erp/shared` đã chạy được.** Các service `auth/order/inventory/api-gateway` mới là scaffold, `frontend` chưa có code. Chi tiết: [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md) · Roadmap: [improvement-plan.md](improvement-plan.md).

## Cấu trúc

```
erp-prototype-example/
├── backend/                    # NestJS services + docker-compose
│   ├── shared/                 # ✅ @erp/shared — cache, messaging, observability
│   ├── docker-compose.yml      # ✅ Pub/Sub Emulator (Docker)
│   ├── customer-service/       # ✅ Customer bounded context (DDD/CQRS/Outbox)
│   ├── inventory-service/      # ✅ Inventory — Optimistic Locking (DDD/CQRS/Outbox)
│   ├── api-gateway/            # ⬜ scaffold — JWT verify + routing (chưa code)
│   ├── auth-service/           # ⬜ scaffold — bcrypt, JWT, RBAC (chưa code)
│   └── order-service/          # ⬜ scaffold — Saga, CQRS, Aggregate Root (chưa code)
├── frontend/                   # ⬜ Next.js 15 + Ant Design 5 (thư mục rỗng)
├── docs/                       # Tài liệu kiến trúc + API + hướng dẫn
├── improvement-plan.md         # Roadmap củng cố cái đã có
└── prototype-development-plan.md
```

> Chú thích: ✅ đã chạy · ⬜ chưa implement. Xem [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md).

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | NestJS, Prisma, TypeScript |
| Frontend | Next.js 15, Ant Design 5, Tailwind CSS |
| Database | Supabase PostgreSQL (free) |
| Cache | Upstash Redis (free) |
| Message Queue | GCP Pub/Sub Emulator (Docker) |
| Auth | bcrypt + JWT (tự code) |

## Quick Start (thực tế hiện tại)

> Hiện chỉ `customer-service` chạy được. Các service khác là scaffold (sẽ build sau theo [improvement-plan.md](improvement-plan.md)).

```bash
# 1. Clone
git clone <repo-url>
cd erp-prototype-example

# 2. Cấu hình environment (1 file .env duy nhất ở backend/)
cp backend/.env.example backend/.env
# Sửa .env: điền DATABASE_URL + DIRECT_URL (Supabase), UPSTASH_REDIS_REST_URL/TOKEN

# 3. Tạo schema "customer" trên Supabase
cd backend/scripts && npm install && npm run setup:schemas

# 4. Start Pub/Sub Emulator
cd ../ && docker compose up -d        # từ thư mục backend/

# 5. Cài @erp/shared rồi build
npm run install:shared && npm run build:shared   # từ backend/

# 6. Start customer-service (migrate + run)
cd customer-service && npm install
npx prisma generate && npx prisma db push
npm run start:dev                     # KHÔNG phải "npm run dev"

# 7. Kiểm tra
curl http://localhost:3001/health     # {"status":"ok",...}
```

> Cách nhanh hơn từ `backend/`: `npm run dev:customer` (orchestrator script).
> Các service `auth/order/inventory/api-gateway` và `frontend` **chưa có code** — bỏ qua cho tới khi được build.

## Documentation

Xem chi tiết tại [docs/](docs/README.md)
