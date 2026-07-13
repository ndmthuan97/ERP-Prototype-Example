---
type: Reference
title: "Implementation Status"
description: "Source of truth for implementation status of all services, pages, patterns, and database schemas"
tags: [reference, status, implementation, erp]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Implementation Status — Source of Truth

> **Đọc file này trước tiên.** Cập nhật lần cuối: **2026-07-08**.

**Chú thích:** ✅ Đã implement · 🚧 Đang làm · ⬜ Chưa làm

---

## Backend Services

| Service | Port | Trạng thái | Ghi chú |
|---|---|:---:|---|
| `@erp/shared` (library) | — | ✅ | Cache, messaging (outbox worker, pubsub publisher/subscriber, idempotency), observability (structured logger, metrics, health, correlation), contracts, config |
| `customer-service` | 3001 | ✅ | DDD 4 layers, CQRS-lite, Outbox, Redis cache (Zod-validated), API versioning `/v1` |
| `inventory-service` | 3003 | ✅ | DDD, CQRS, Outbox, **Optimistic Locking** (version + retry/backoff), REST reserve/release, **decimal quantity** support, API versioning `/v1` |
| `sales-service` | 3002 | ✅ | DDD, Aggregate Root, Outbox, **Synchronous HTTP submit** (reserve + credit-check), Circuit Breaker (opossum) for Inventory + Customer, **VAT/Tax per line**, **Delivery Order 6-state**, **Sales Return**, **partial delivery**, API versioning `/v1` |
| `catalog-service` | 3005 | ✅ | DDD 4 layers, product CRUD, Outbox, **taxRate per product** (VN rates: 0/5/8/10%), API versioning `/v1` |
| `purchasing-service` | 3006 | ✅ | DDD 4 layers, purchase order lifecycle (draft→placed→received), Outbox, **Supplier entity CRUD**, API versioning `/v1` |
| `auth-service` | 3004 | ✅ | DDD 4 layers, **Google sign-in (Identity Platform/Firebase)** qua `POST /auth/sso/callback`, **session whitelist** (`app_auth.sessions` + Redis), allowlist email (interim), revoke tức thì (logout + deactivation), register password-less, RBAC 3-role, API versioning `/v1` (**B1**) |
| `api-gateway` | 3010 | ✅ | App token HS256 verify + **per-request session check** (Redis `session:<sid>` `getex`, slide TTL) → inject `x-user-sid` + `x-user-*`, proxy routing → 6 services + `/api/suppliers`, **Helmet** security headers, **Rate limiting** (100/15min global) |
| `frontend` (Next.js 15) | 3000 | ✅ | Ant Design 5, React Query, Dashboard, Customer/Inventory/Orders/Catalog/Purchasing/Supplier pages, Delivery + Return tabs, Error Boundary, Responsive sidebar |

---

## Frontend Pages & Components

| Page/Component | Route | Trạng thái | Ghi chú |
|---|---|:---:|---|
| Dashboard | `/` | ✅ | KPI cards + charts + recent tables |
| Login | `/login` | ✅ | **Sign in with Google** (Firebase `signInWithPopup`), đổi ID token lấy app token (B1) |
| Customer List | `/customers` | ✅ | CRUD + search + pagination |
| Customer Detail | `/customers/[id]` | ✅ | Detail view |
| Inventory List | `/inventory` | ✅ | Stock items + search |
| Inventory Detail | `/inventory/[sku]` | ✅ | Item detail + receive |
| Order List | `/orders` | ✅ | Filter by status, pagination, create draft |
| Order Detail | `/orders/[id]` | ✅ | Header, lines, add line, lifecycle timeline, **Delivery tab**, **Return tab** |
| Catalog | `/catalog` | ✅ | Product CRUD |
| PO List | `/purchasing` | ✅ | PO table, create modal with supplier select, supplier name display |
| **PO Detail** | `/purchasing/[id]` | ✅ | **NEW** — Header, lines, add/remove line, place, receive goods, cancel |
| **Supplier CRUD** | `/purchasing/suppliers` | ✅ | **NEW** — Table, create, edit modals |
| DeliveryTab | (component) | ✅ | **NEW** — DO list, create, status lifecycle actions |
| ReturnTab | (component) | ✅ | **NEW** — Return list, create, approve/reject/complete |
| AppShell | (layout) | ✅ | **Updated** — Responsive sidebar, collapsible, Supplier sub-menu |
| StatCard | (component) | ✅ | Reusable KPI card |

### Frontend API Clients

| Module | Methods | Trạng thái |
|---|---|:---:|
| `sales.ts` | `salesApi` (8), `deliveryApi` (7), `returnApi` (6) | ✅ |
| `purchasing.ts` | `purchasingApi` (8) | ✅ |
| `supplier.ts` | `supplierApi` (4) | ✅ **NEW** |
| `catalog.ts` | `catalogApi` (5) | ✅ |
| `customer.ts` | `customerApi` (7) | ✅ |
| `inventory.ts` | `inventoryApi` (5) | ✅ |
| `client.ts` | Centralized HTTP + 401 session expiry handling | ✅ |

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
| Synchronous Submit Flow (HTTP reserve + credit-check) | ✅ | sales → inventory (HTTP), sales → customer (HTTP) |
| Circuit Breaker (opossum) | ✅ | sales → inventory, sales → customer HTTP calls |
| Optimistic Locking | ✅ | inventory-service (`version` + retry) |
| SSO Auth (Identity Platform) + Session Whitelist | ✅ | auth-service + api-gateway (**B1** — Google sign-in, `session:<sid>` Redis, revoke tức thì) |
| API Versioning (`/v1/`) | ✅ | All 6 services + gateway proxy |
| Rate Limiting | ✅ | api-gateway (express-rate-limit) |
| Error Boundary (React) | ✅ | frontend |
| VAT/Tax per Line | ✅ | catalog (taxRate) + sales (taxAmount, subtotalAmount, totalTaxAmount) |
| Delivery Order (6-state lifecycle) | ✅ | sales-service (draft→picking→packed→shipped→delivered\|failed) |
| Partial Delivery | ✅ | sales-service (partially_delivered → fully_delivered) |
| Sales Return | ✅ | sales-service (draft→approved→goods_received→completed\|rejected) |
| Supplier Entity | ✅ | purchasing-service (CRUD + activate/deactivate) |
| Decimal Quantity | ✅ | sales, inventory, purchasing (Decimal 18,4) |

---

## Database (Supabase PostgreSQL — Multi-Schema)

| Schema | Bảng | Trạng thái |
|---|---|:---:|
| `customer` | `cores`, `outbox` | ✅ |
| `inventory` | `stock_items`, `outbox` | ✅ |
| `sales` | `headers`, `lines`, `status_history`, `lifecycle_view`, `outbox` | ✅ |
| `sales` | `delivery_orders`, `delivery_lines` | ✅ |
| `sales` | `sales_returns`, `sales_return_lines` | ✅ |
| `catalog` | `products`, `outbox` | ✅ |
| `purchasing` | `purchase_orders`, `purchase_order_lines`, `outbox` | ✅ |
| `purchasing` | `suppliers` | ✅ |
| `app_auth` | `users`, `sessions` | ✅ |

> **B1:** `sessions(id, user_id, started_at, expires_at, ip, user_agent)` là session whitelist (theo new-erp-design `03-module-requirements §3.4`). `refresh_tokens` deprecated — Firebase quản refresh token (revoke qua `revokeRefreshTokens`).

---

## DevOps

| Hạng mục | Trạng thái |
|---|:---:|
| Pub/Sub Emulator (docker-compose) | ✅ |
| Docker Compose DEV (all services + hot-reload) | ✅ |
| Dockerfile (multi-stage production builds) | ✅ |
| Setup scripts (`create-schemas.js`, `verify-connections.js`) | ✅ |
| CI pipeline (lint + build + test — customer, inventory) | ✅ |
| E2E Tests (Docker-based, all flows) | ✅ | 9 suites, ~80+ test cases covering all 9 business flows |

---

## Recent Upgrades

### B1 — Auth: Google Sign-in + Session Whitelist (2026-07-08)

| Area | Changes |
|---|---|
| **Frontend** | Login → "Sign in with Google" (Firebase `signInWithPopup`); đổi Firebase ID token lấy app token qua `/auth/sso/callback` |
| **Auth Service** | `POST /auth/sso/callback` (verify Firebase ID token, allowlist email, link `firebaseUid`, tạo session, trả app token HS256 có `sid`, TTL 1h); `/auth/register` password-less; `/auth/logout` xoá session (`x-user-sid`); deactivation revoke toàn bộ session + `revokeRefreshTokens`; **gỡ** login/refresh/password |
| **API Gateway** | Verify app token HS256 + **per-request session check** Redis `session:<sid>` (`getex`, slide TTL) → 401 khi miss (logout/deactivation/idle); inject `x-user-sid` |
| **Database** | +`app_auth.sessions(id, user_id, started_at, expires_at, ip, user_agent)`; `refresh_tokens` deprecated |
| **Infra** | Terraform `infra/modules/identity-platform` (Identity Platform + Google IdP + SA `roles/firebaseauth.admin`); OAuth consent/client + apiKey là bước console thủ công |
| **Closes** | **FR-A13** (revoke tức thì) + **FR-A9** (idle timeout theo role, mặc định 30m) |
| **Interim deviations (D-004)** | Consumer Gmail + allowlist thay Workspace domain SSO; MFA chưa enforce; OTP (FR-A2) + RBAC-as-code (FR-A4/A6/A8) out of scope |

### Phase FE Completion (2026-06-26) — Frontend Parity

| Area | Changes |
|---|---|
| **Types** | +130 lines: DeliveryOrder, SalesReturn, Supplier, PurchaseOrderDetail, tax fields on SO/line |
| **API Clients** | +`deliveryApi` (7), +`returnApi` (6), +`supplierApi` (4), rewrite `purchasingApi` (8) |
| **New Pages** | PO Detail (`/purchasing/[id]`), Supplier CRUD (`/purchasing/suppliers`) |
| **New Components** | DeliveryTab, ReturnTab (order detail tabs) |
| **UX** | Responsive sidebar, 401 session expiry, formatTaxRate/formatQuantity |
| **Cleanup** | SAGA_ENABLED removed, status maps updated (partially_delivered/fully_delivered) |

### Hybrid Communication (2026-06-26) — Architecture Migration

| Area | Changes |
|---|---|
| **Architecture** | Submit flow migrated from Pub/Sub Saga (4-step async) to synchronous HTTP (reserve + credit-check + confirm in 1 request) |
| **Inventory Service** | +`ReserveBatchCommand`, +`ReleaseBatchCommand`, +batch HTTP endpoints, removed `HandleSalesOrderSubmittedCommand` from DI |
| **Sales Service** | +`InventoryClient` (HTTP + Circuit Breaker), rewritten `SubmitSalesOrderCommand`, removed Saga handlers and subscriber |
| **API Gateway** | CORS fixed: `origin: true` → whitelist with env override |
| **Entity Encapsulation** | `SalesOrder` + `StockItem` — mutable props → private + getters |
| **Bug Fixes** | Floating-point money (Math.round), `aggregateId: 'saga'` → orderId, Vietnamese → English errors |
| **Domain Errors** | `DeliveryOrder` + `SalesReturn` — generic Error → `InvalidStatusTransitionError` |

### Phase 0-4 (2026-06-25) — Domain Enhancement

| Phase | Changes |
|---|---|
| **Phase 0** | Allow `unitPrice=0` (free items), decimal `quantity` (3 services), credit check with `pendingOrdersTotal` |
| **Phase 1** | Supplier entity (CRUD + activate/deactivate) in purchasing-service |
| **Phase 2** | VAT/Tax per line: `taxRate` on catalog products, `taxAmount`/`subtotalAmount`/`totalTaxAmount` on sales |
| **Phase 3** | DeliveryOrder 6-state lifecycle, partial delivery (`partially_delivered`/`fully_delivered`), `HandleDeliveryCompletedCommand` |
| **Phase 4** | SalesReturn lifecycle (`draft→approved→goods_received→completed\|rejected`) |

### Previous (2026-06-23) — Security & Quality

- **Security:** Rate limiting, Helmet, graceful JWT_SECRET startup
- **Backend:** Circuit breaker, API versioning `/v1/`, entity `update()` encapsulation, Zod cache validation, dead code cleanup
- **Frontend:** Error Boundary, logo fix (no external URL), revenue label accuracy, empty state tables
- **Logs:** All Vietnamese log messages → English (shared + sales-service)
