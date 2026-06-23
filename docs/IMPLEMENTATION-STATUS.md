# Implementation Status — Source of Truth

> **Đọc file này trước tiên.** Cập nhật lần cuối: **2026-06-23**.

**Chú thích:** ✅ Đã implement · 🚧 Đang làm · ⬜ Chưa làm

---

## Backend Services

| Service | Port | Trạng thái | Ghi chú |
|---|---|:---:|---|
| `@erp/shared` (library) | — | ✅ | Cache, messaging (outbox worker, pubsub publisher/subscriber, idempotency), observability (structured logger, metrics, health, correlation), contracts, config |
| `customer-service` | 3001 | ✅ | DDD 4 layers, CQRS-lite, Outbox, Redis cache (Zod-validated), API versioning `/v1` |
| `inventory-service` | 3003 | ✅ | DDD, CQRS, Outbox, **Optimistic Locking** (version + retry/backoff), REST reserve/release, API versioning `/v1` |
| `sales-service` | 3002 | ✅ | DDD, Aggregate Root, Outbox, **Saga choreography** (publisher + subscriber), credit-check HTTP with **Circuit Breaker** (opossum), API versioning `/v1` |
| `catalog-service` | 3005 | ✅ | DDD 4 layers, product CRUD, Outbox, API versioning `/v1` |
| `purchasing-service` | 3006 | ✅ | DDD 4 layers, purchase order lifecycle (draft→placed→received), Outbox, API versioning `/v1` |
| `auth-service` | 3004 | ✅ | DDD 4 layers, JWT login/refresh/logout, bcrypt password hashing, RBAC, API versioning `/v1` |
| `api-gateway` | 3010 | ✅ | JWT verification, proxy routing → 6 services, **Helmet** security headers, **Rate limiting** (100/15min global, 5/15min login) |
| `frontend` (Next.js 15) | 3000 | ✅ | Ant Design 5, React Query, Dashboard + Customer/Inventory/Orders/Catalog/Purchasing pages, Error Boundary |

---

## Patterns & Capabilities

| Hạng mục | Trạng thái | Ở đâu |
|---|:---:|---|
| DDD Layers (domain/application/infrastructure/presentation) | ✅ | All 6 services |
| Repository Pattern (port ở domain, adapter ở infrastructure) | ✅ | All services |
| Outbox Pattern (write event trong transaction) | ✅ | All services + shared |
| Outbox Worker (poll → publish Pub/Sub, retry, DLQ) | ✅ | shared — `FOR UPDATE SKIP LOCKED` |
| Cache-Aside (Redis + Zod validation) | ✅ | customer-service + shared |
| Observability (correlationId, structured log, metrics, health) | ✅ | shared |
| Event Envelope (versioned + eventId) | ✅ | shared contracts |
| Idempotent Consumer (`withIdempotency`) | ✅ | shared + sales-service subscriber |
| CQRS (lifecycle_view read model) | ✅ | sales-service |
| Aggregate Root (SalesOrder entity) | ✅ | sales-service |
| Saga Choreography (order → inventory → credit-check) | ✅ | sales ↔ inventory via Pub/Sub |
| Circuit Breaker (opossum) | ✅ | sales → customer HTTP call |
| Optimistic Locking | ✅ | inventory-service (`version` + retry) |
| JWT Authentication | ✅ | auth-service + api-gateway |
| API Versioning (`/v1/`) | ✅ | All 6 services + gateway proxy |
| Rate Limiting | ✅ | api-gateway (express-rate-limit) |
| Error Boundary (React) | ✅ | frontend |

---

## Database (Supabase PostgreSQL — Multi-Schema)

| Schema | Bảng | Trạng thái |
|---|---|:---:|
| `customer` | `cores`, `outbox` | ✅ |
| `inventory` | `stock_items`, `outbox` | ✅ |
| `order` | `headers`, `lines`, `status_history`, `lifecycle_view`, `outbox` | ✅ |
| `catalog` | `products`, `outbox` | ✅ |
| `purchasing` | `purchase_orders`, `purchase_order_lines`, `outbox` | ✅ |
| `app_auth` | `users`, `refresh_tokens` | ✅ |

---

## DevOps

| Hạng mục | Trạng thái |
|---|:---:|
| Pub/Sub Emulator (docker-compose) | ✅ |
| Setup scripts (`create-schemas.js`, `verify-connections.js`) | ✅ |
| CI pipeline (lint + build + test — customer, inventory) | ✅ |
| Dockerfile production builds | ⬜ |

---

## Recent Upgrade (2026-06-23)

Changes from [upgrade-plan.md](upgrade-plan.md) execution:

- **Security:** Rate limiting, Helmet, graceful JWT_SECRET startup
- **Backend:** Circuit breaker, API versioning `/v1/`, entity `update()` encapsulation, Zod cache validation, dead code cleanup
- **Frontend:** Error Boundary, logo fix (no external URL), revenue label accuracy, empty state tables
- **Logs:** All Vietnamese log messages → English (shared + sales-service)
