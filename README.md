# ERP Prototype Example

> Prototype validate kiến trúc microservices: DDD, Event-driven, CQRS, Outbox, Saga, Aggregate Root.

> ✅ **Trạng thái:** Tất cả **6 backend services** + API Gateway + Frontend đã implement đầy đủ. Chi tiết: [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md).

## Cấu trúc

```
erp-prototype-example/
├── backend/                    # NestJS services + docker-compose
│   ├── shared/                 # ✅ @erp/shared — cache, messaging, observability
│   ├── docker-compose.yml      # ✅ Pub/Sub Emulator (Docker — container DUY NHẤT)
│   ├── auth-service/           # ✅ Auth — bcrypt, JWT, RBAC (:3004)
│   ├── customer-service/       # ✅ Customer — DDD, Value Object, Outbox (:3001)
│   ├── sales-service/          # ✅ Sales — Saga, CQRS, Aggregate Root, Delivery, Return (:3002)
│   ├── inventory-service/      # ✅ Inventory — Optimistic Locking, Outbox (:3003)
│   ├── catalog-service/        # ✅ Catalog — Product CRUD, taxRate, Outbox (:3005)
│   ├── purchasing-service/     # ✅ Purchasing — PO lifecycle, Supplier, Outbox (:3006)
│   └── api-gateway/            # ✅ Gateway — JWT verify, proxy, rate limiting (:3010)
├── frontend/                   # ✅ Next.js 15 + Ant Design 5 — Dashboard, CRUD, Saga UI (:3000)
└── docs/                       # Tài liệu kiến trúc + API + hướng dẫn
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | NestJS, Prisma, TypeScript |
| Frontend | Next.js 15, Ant Design 5, Tailwind CSS, React Query |
| Database | Supabase PostgreSQL (free) |
| Cache | Upstash Redis (free) |
| Message Queue | GCP Pub/Sub Emulator (Docker) |
| Auth | bcrypt + JWT (tự code) |

## Quick Start

> Hướng dẫn chi tiết đầy đủ: [docs/development/getting-started.md](docs/development/getting-started.md)

```bash
# 1. Clone
git clone <repo-url>
cd erp-prototype-example

# 2. Cấu hình environment (1 file .env duy nhất ở backend/)
cp backend/.env.example backend/.env
# Sửa .env: điền DATABASE_URL + DIRECT_URL (Supabase), UPSTASH_REDIS_REST_URL/TOKEN

# 3. Start Pub/Sub Emulator (Docker — container duy nhất cần Docker)
cd backend && docker compose up -d

# 4. Lần đầu: install + build + generate
npm run install:all
npm run build:shared
npm run prisma:all

# 5. Chạy dev — 1 lệnh, tất cả 6 services hot-reload
npm run dev:all

# 6. Start Frontend (terminal riêng)
cd ../frontend && npm install && npm run dev

# 7. Kiểm tra
curl http://localhost:3010/health     # API Gateway health
```

---

## Hướng dẫn đọc tài liệu

> Đọc theo thứ tự từ trên xuống để hiểu toàn bộ hệ thống.

| Bước | Đọc gì | Mục đích |
|:---:|---|---|
| 1 | [Project Goals](docs/overview/project-goals.md) | Hiểu mục tiêu, scope |
| 2 | [Business Requirements](docs/overview/business-requirements.md) | Hiểu nghiệp vụ, user stories |
| 3 | [Glossary](docs/overview/glossary.md) | Nắm thuật ngữ |
| 4 | [Tech Decisions](docs/overview/tech-decisions.md) | Tại sao chọn từng công nghệ |
| 5 | [System Overview](docs/architecture/system-overview.md) | Sơ đồ tổng thể, tech stack, `@erp/shared` |
| 6 | [Service Quick Reference](docs/services/) | Port, schema, dependencies cho từng service |
| 7 | [Bounded Contexts](docs/architecture/bounded-contexts.md) | 6 contexts, data ownership |
| 8 | [Data Model](docs/architecture/data-model.md) | ER diagrams, table definitions |
| 9 | [Event Flows](docs/architecture/event-flows.md) | Pub/Sub topics, saga flow |
| 10 | [Design Patterns](docs/architecture/design-patterns.md) | 14+ patterns giải thích |
| 11 | [RBAC](docs/architecture/rbac.md) | 3 roles, permission matrix |
| 12 | [System Flows](docs/flows.md) | 9 luồng nghiệp vụ chính |
| 13 | [API Reference](docs/api/) | Endpoints cho từng service |
| 14 | [Getting Started](docs/development/getting-started.md) | Setup + chạy lần đầu |
| 15 | [Coding Standards](docs/development/coding-standards.md) | Quy tắc code, tích hợp `@erp/shared` |

---

## Tìm theo nhu cầu

| Tôi muốn... | Đọc |
|---|---|
| Hiểu dự án này làm gì | [Project Goals](docs/overview/project-goals.md) |
| Hiểu 1 service cụ thể | [Services](docs/services/) — quick reference per service |
| Setup chạy local | [Getting Started](docs/development/getting-started.md) |
| Xem API endpoints | [Auth](docs/api/auth-endpoints.md) · [Customer](docs/api/customer-endpoints.md) · [Sales](docs/api/order-endpoints.md) · [Inventory](docs/api/inventory-endpoints.md) · [Catalog](docs/api/catalog-endpoints.md) · [Purchasing](docs/api/purchasing-endpoints.md) |
| Xem system flows | [Flows](docs/flows.md) — Auth, Saga, Delivery, Return, Purchasing, Catalog |
| Hiểu kiến trúc | [System Overview](docs/architecture/system-overview.md) |
| Hiểu Saga flow | [Event Flows](docs/architecture/event-flows.md) · [Flows](docs/flows.md#flow-2-sales-order-saga-) |
| Hiểu database schema | [Data Model](docs/architecture/data-model.md) |
| Biết quy tắc phân quyền | [RBAC](docs/architecture/rbac.md) |
| Hiểu tại sao chọn NestJS, Prisma... | [Tech Decisions](docs/overview/tech-decisions.md) |
| Hiểu `@erp/shared` package | [System Overview → §11](docs/architecture/system-overview.md) · [Design Patterns → §12–14](docs/architecture/design-patterns.md) · [Coding Standards → §8–9](docs/development/coding-standards.md) |
| Xem technical review | [Technical Review](docs/technical-review.md) |
| Xem E2E test plan | [E2E Test Plan](docs/e2e-test-plan.md) |
| Xem tài liệu đã archive | [Archive](docs/archive/) — upgrade-plan, domain-gap-analysis |

---

## Documentation

Xem chi tiết tại [docs/](docs/index.md)
