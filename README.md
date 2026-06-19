# ERP Prototype Example

> Prototype validate kiến trúc microservices: DDD, Event-driven, CQRS, Outbox, Saga, Aggregate Root.

## Cấu trúc

```
erp-prototype-example/
├── backend/                    # 5 NestJS services + docker-compose
│   ├── docker-compose.yml      # Pub/Sub Emulator (Docker)
│   ├── api-gateway/            # Entry point — JWT verify + routing
│   ├── auth-service/           # Auth — bcrypt, JWT, RBAC
│   ├── customer-service/       # Customer bounded context
│   ├── order-service/          # Order — Saga, CQRS, Aggregate Root
│   └── inventory-service/      # Inventory — Optimistic Locking
├── frontend/                   # Next.js 15 + Ant Design 5
├── docs/                       # Tài liệu kiến trúc + API + hướng dẫn
└── prototype-development-plan.md
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | NestJS, Prisma, TypeScript |
| Frontend | Next.js 15, Ant Design 5, Tailwind CSS |
| Database | Supabase PostgreSQL (free) |
| Cache | Upstash Redis (free) |
| Message Queue | GCP Pub/Sub Emulator (Docker) |
| Auth | bcrypt + JWT (tự code) |

## Quick Start

```bash
# 1. Clone và cài đặt
git clone <repo-url>
cd erp-prototype-example

# 2. Cấu hình environment
cp backend/.env.example backend/.env
# Sửa .env: điền Supabase URL, Upstash URL, JWT secret

# 3. Start Pub/Sub Emulator
cd backend && docker compose up -d

# 4. Start services (mỗi terminal riêng)
cd backend/auth-service && npm install && npm run dev
cd backend/customer-service && npm install && npm run dev
cd backend/order-service && npm install && npm run dev
cd backend/inventory-service && npm install && npm run dev
cd backend/api-gateway && npm install && npm run dev

# 5. Start frontend
cd frontend && npm install && npm run dev
```

## Documentation

Xem chi tiết tại [docs/](docs/README.md)
