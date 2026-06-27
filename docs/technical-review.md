---
type: Technical Review
title: "Technical Review Board — ERP Prototype"
description: "Comprehensive technical review covering architecture, code quality, security, and production readiness"
tags: [review, architecture, security, quality]
timestamp: "2026-06-23T00:00:00+07:00"
---

# 🏛️ Technical Review Board — ERP Prototype Example

> **Review Date:** 2026-06-23 (updated: 2026-06-26)  
> **Board:** Software Architect · Staff Engineer · Tech Lead · Backend/Frontend/Mobile/Database/Security/QA/DevOps/SRE Engineers · UI/UX Designer · Product Manager · Engineering Manager · Technical Writer  
> **Project:** ERP Prototype — Microservices architecture learning project  
> **Commit Context:** Production-readiness assessment based on full source code analysis  
> **Updates:** Circuit Breaker, API Versioning, Rate Limiting đã implement. FE đã hoàn thiện đầy đủ.

---

## PHẦN 1 — PROJECT OVERVIEW

### Loại dự án
**Learning/Prototype** — dự án validate kiến trúc microservices cho ERP (Enterprise Resource Planning) với các pattern nâng cao: DDD, Event-Driven, CQRS, Outbox, Saga, Aggregate Root.

### Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | NestJS, Prisma v7, TypeScript |
| Frontend | Next.js 15, Ant Design 5, React 19, TanStack React Query |
| Database | Supabase PostgreSQL (free tier) |
| Cache | Upstash Redis REST API |
| Message Queue | GCP Pub/Sub Emulator (Docker) |
| Auth | bcrypt + JWT (self-implemented) |
| CI/CD | GitHub Actions |
| Container | Docker Compose (dev) |

### Kiến trúc hiện tại
**Microservices** — 7 backend services + 1 API Gateway + 1 Frontend:

| Service | Port | Status |
|---|---|:---:|
| `@erp/shared` (library) | — | ✅ Production-ready |
| `customer-service` | 3001 | ✅ Full implementation |
| `inventory-service` | 3003 | ✅ Full implementation |
| `sales-service` | 3002 | ✅ Full implementation |
| `catalog-service` | 3005 | ✅ Built (needs verification) |
| `purchasing-service` | 3006 | ✅ Built (needs verification) |
| `auth-service` | 3004 | ✅ Built (DDD layers) |
| `api-gateway` | 3010 | ✅ JWT + Proxy routing |
| `frontend` | 3000 | ✅ Dashboard + CRUD pages |

### Domain nghiệp vụ
ERP core modules: **Customer Management**, **Sales Orders** (with saga), **Inventory** (optimistic locking), **Catalog** (product master), **Purchasing** (purchase orders + goods receipt), **Auth** (JWT + RBAC).

### Quy mô hệ thống
- **~9 bounded contexts** separated by database schema
- **~80+ source files** across backend services
- **~20+ frontend pages/components**
- **Single PostgreSQL database** with multi-schema isolation

### Các dependency chính
- `@nestjs/core` + `@nestjs/common` (DI framework)
- `@prisma/client` v7 (ORM with multi-schema)
- `@google-cloud/pubsub` (event messaging)
- `@upstash/redis` (REST-based cache)
- `jsonwebtoken` + `bcryptjs` (auth)
- `zod` (validation)
- `antd` v5 + `@tanstack/react-query` (frontend)

### Luồng hoạt động chính

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant GW as API Gateway
    participant Auth as Auth Service
    participant CS as Customer Service
    participant SS as Sales Service
    participant IS as Inventory Service
    participant PS as Pub/Sub

    FE->>GW: POST /api/auth/login
    GW->>Auth: Forward (public route)
    Auth-->>GW: JWT tokens
    GW-->>FE: tokens + user

    FE->>GW: POST /api/orders (with JWT)
    GW->>GW: Verify JWT
    GW->>SS: Forward + x-user-* headers
    SS->>CS: Credit check (HTTP)
    SS->>SS: Write order + outbox event
    SS-->>GW: Order created

    Note over SS,PS: Outbox Worker polls
    SS->>PS: sales-order.submitted
    PS->>IS: Reserve stock
    IS->>PS: inventory.reserved
    PS->>SS: Confirm order (saga)
```

---

## PHẦN 2 — ARCHITECTURE REVIEW

### Architecture Style
**Microservices + Event-Driven + DDD (Domain-Driven Design)**

Mỗi service tuân theo DDD 4-layer architecture:
```
domain/          → Entities, Value Objects, Repository interfaces (Ports)
application/     → Commands (write), Queries (read) — CQRS-lite
infrastructure/  → Prisma repositories (Adapters), Pub/Sub, Cache
presentation/    → NestJS Controllers (HTTP layer)
```

### Ưu điểm

| Tiêu chí | Đánh giá | Ghi chú |
|---|:---:|---|
| Layer Separation | ⭐⭐⭐⭐⭐ | Domain hoàn toàn độc lập infrastructure |
| Modularity | ⭐⭐⭐⭐ | Mỗi service tách biệt, shared lib tốt |
| Coupling | ⭐⭐⭐⭐ | Dependency Inversion qua token injection |
| Cohesion | ⭐⭐⭐⭐⭐ | Mỗi command/query = 1 use case (SRP) |
| Extensibility | ⭐⭐⭐⭐ | Thêm service mới dễ dàng theo template |

**Điểm tốt nổi bật:**
1. **Outbox Pattern** triển khai chuẩn: business data + event trong cùng transaction → at-least-once delivery
2. **Idempotent Consumer** 2-trạng thái (`processing` → `done`) an toàn hơn cách thông thường
3. **Generic Outbox Worker** trong shared lib — DRY, mỗi service chỉ cung cấp adapter
4. **Event Envelope versioned** với `eventId` dedup — sẵn sàng cho schema evolution
5. **Correlation ID** xuyên service (AsyncLocalStorage) — truy vết saga tốt
6. **Optimistic Locking** trong inventory-service với retry/backoff

### Nhược điểm & Rủi ro

| Vấn đề | Mức độ | Vị trí |
|---|:---:|---|
| **Single Database** cho tất cả services | 🟠 HIGH | Toàn bộ backend dùng 1 Supabase instance |
| **Shared DB = Distributed Monolith risk** | 🟡 MEDIUM | Multi-schema trên cùng 1 PostgreSQL |
| **No service discovery** | 🟡 MEDIUM | Hardcoded URLs trong docker-compose |
| ~~**No circuit breaker**~~ | ✅ FIXED | Đã implement opossum circuit breaker (sales → customer) |
| **Polling-based outbox** (setInterval) | 🟢 LOW | Acceptable cho prototype |

### Bottleneck
- **Single Supabase PostgreSQL (free tier)**: mọi service đọc/ghi cùng 1 instance → single point of failure, connection pool limit
- **Outbox Worker polling mỗi 2s**: latency cố định 0–2s cho event delivery. Production cần LISTEN/NOTIFY hoặc WAL-based CDC

### Rủi ro dài hạn
- **Database coupling**: dù dùng multi-schema nhưng shared connection pool → 1 service heavy load ảnh hưởng tất cả
- ~~**No API versioning**~~: ✅ Đã implement API versioning `/v1/` trên tất cả services + gateway proxy

### Kết luận kiến trúc
> Kiến trúc hiện tại **PHÙ HỢP cho mục tiêu prototype/learning**. KHÔNG cần thay đổi kiến trúc tổng thể. Cần bổ sung: circuit breaker, retry pattern cho inter-service HTTP calls, và tách database khi scale.

---

## PHẦN 3 — CODE QUALITY REVIEW

### Folder Structure ⭐⭐⭐⭐⭐

```
backend/
├── shared/src/           # Shared kernel — rất tốt
│   ├── cache/
│   ├── config/
│   ├── contracts/        # Event type + payload interfaces
│   ├── domain/
│   ├── messaging/        # Outbox worker, PubSub, idempotency
│   ├── observability/    # Logger, metrics, health, correlation
│   └── persistence/
├── customer-service/src/
│   ├── domain/entities/        # Aggregate Root
│   ├── domain/value-objects/   # TaxCode VO
│   ├── domain/repositories/    # Port (interface)
│   ├── application/commands/   # Write use cases
│   ├── application/queries/    # Read use cases
│   ├── application/dtos/       # Zod schemas
│   ├── infrastructure/persistence/  # Adapter (Prisma)
│   ├── presentation/           # Controller
│   └── common/                 # Exception filters
```

**Đánh giá:** Folder structure là **exemplary** cho DDD + Clean Architecture. Mỗi layer rõ ràng, dependency direction đúng (domain ← application ← infrastructure ← presentation).

### Naming Convention ⭐⭐⭐⭐
- Files: `kebab-case` ✅
- Classes: `PascalCase` ✅
- Methods: `camelCase` ✅
- Constants: `UPPER_SNAKE_CASE` cho DI tokens ✅
- Suffix pattern: `.command.ts`, `.query.ts`, `.entity.ts`, `.vo.ts`, `.repository.ts`, `.impl.ts` ✅

### SOLID Compliance

| Principle | Score | Evidence |
|---|:---:|---|
| **S** — Single Responsibility | ⭐⭐⭐⭐⭐ | Mỗi command/query = 1 use case |
| **O** — Open/Closed | ⭐⭐⭐⭐ | Mới service chỉ cần implement interface |
| **L** — Liskov Substitution | ⭐⭐⭐⭐ | Repository interface → PrismaRepository implementation |
| **I** — Interface Segregation | ⭐⭐⭐⭐⭐ | ICustomerRepository gọn, không fat interface |
| **D** — Dependency Inversion | ⭐⭐⭐⭐⭐ | Token injection, domain không biết Prisma |

### Code Smell / Anti-pattern Detected

#### 1. 🟡 Entity Properties Not Encapsulated
- **File:** [customer.entity.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/src/domain/entities/customer.entity.ts#L48-L85)
- **Mô tả:** Properties `businessName`, `taxCode`, `status`, `creditLimitAmount`, etc. là `public` — cho phép mutate trực tiếp từ bên ngoài entity
- **Hậu quả:** Bypass business rules (vd: có thể set `status = 'active'` trực tiếp thay vì qua `activate()`)
- **Hướng xử lý:** Đổi thành `private` + getter/setter với business validation. Hoặc ít nhất dùng `readonly` + explicit mutation methods

#### 2. 🟡 `applyChanges()` in Command Mutates Entity Directly
- **File:** [update-customer.command.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/src/application/commands/update-customer.command.ts#L99-L124)
- **Mô tả:** Application layer trực tiếp gán `customer.businessName = changes.businessName` — bypass domain logic
- **Hậu quả:** Business invariants không được enforce tập trung tại entity
- **Hướng xử lý:** Tạo `customer.update(changes)` method ở entity layer

#### 3. 🟡 Cache Serialization/Deserialization Duplicated
- **File:** [get-customer.query.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/src/application/queries/get-customer.query.ts#L76-L112)
- **Mô tả:** `serializeForCache()` và `reconstructFromCache()` dùng unsafe type casting (`data.id as string`)
- **Hậu quả:** Runtime error nếu cache schema thay đổi
- **Hướng xử lý:** Dùng Zod parse cho cache deserialization

#### 4. 🟢 Vietnamese Log Messages in Production Code
- **File:** Multiple — [outbox-worker.service.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/shared/src/messaging/outbox-worker.service.ts#L92), [redis-cache.service.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/shared/src/cache/redis-cache.service.ts#L34)
- **Mô tả:** Log messages bằng tiếng Việt (`'Outbox Worker bắt đầu...'`) → khó grep/alert trong monitoring tools
- **Hướng xử lý:** Dùng English cho log messages (per global rules). Vietnamese chỉ cho user-facing messages.

#### 5. 🟡 Dead Code — `app.controller.ts` / `app.service.ts` in Some Services
- **File:** [auth-service/src/app.controller.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/auth-service/src/app.controller.ts), [app.service.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/auth-service/src/app.service.ts)
- **Mô tả:** NestJS scaffold files (89 bytes each) không được sử dụng
- **Hướng xử lý:** Xóa dead code

#### 6. 🟡 Over-commenting
- **Toàn bộ project:** Comments rất dày đặc, nhiều comment giải thích điều hiển nhiên. Tốt cho learning nhưng sẽ là maintenance burden.
- **Hướng xử lý:** Giữ chỉ business-critical và non-obvious comments khi chuyển sang production.

---

## PHẦN 4 — BACKEND REVIEW

### API Design ⭐⭐⭐⭐
- RESTful conventions đúng: `POST`, `GET`, `PATCH`, `DELETE`
- HTTP status codes chuẩn: `201 Created`, `204 No Content`, `400 Bad Request`, `404 Not Found`, `409 Conflict`
- Pagination: `?q=&page=&limit=` ✅

**Issues:**

| # | Vấn đề | Vị trí | Mức độ |
|---|---|---|:---:|
| 1 | **No rate limiting** | All services | 🟠 HIGH |
| 2 | **No request timeout** | HTTP calls sales→customer | 🟡 MEDIUM |
| 3 | **No API versioning** (`/v1/customers`) | All controllers | 🟡 MEDIUM |
| 4 | **No pagination metadata** in some responses | Varies | 🟢 LOW |

### Service Design ⭐⭐⭐⭐⭐
- **CQRS-lite**: Command (write) vs Query (read) tách biệt class — rõ ràng
- **Outbox Pattern**: write event + business data trong 1 transaction
- **Domain Entity**: business logic ở entity (credit check, archive)

### Transaction Handling ⭐⭐⭐⭐⭐
- **`$transaction`** cho mọi mutation: upsert + outbox event = atomic ✅
- **P2002 catch** (unique violation) cho race condition on taxCode ✅
- **Optimistic locking** trong inventory-service với version column ✅

### Background Jobs ⭐⭐⭐⭐
- **Outbox Worker**: setInterval polling, batch=10, max attempts=5, DLQ
- **CLAIM mechanism**: `FOR UPDATE SKIP LOCKED` + `locked_until` — safe for multi-instance ✅
- **Guard against overlapping**: `isProcessing` flag ✅

### Issues cần cải thiện

#### No Circuit Breaker on Inter-service HTTP
- **File:** [customer-client.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/sales-service/src/infrastructure/http/customer-client.ts) (assumed)
- **Vấn đề:** Sales → Customer credit check via HTTP. Nếu customer-service down, sales-service sẽ fail cascade
- **Giải pháp:** Thêm circuit breaker (opossum lib) + timeout + fallback

#### No Retry Strategy for Event Processing
- **Vấn đề:** Event subscriber failure có retry qua outbox, nhưng subscriber-side (consumer) failure chỉ dựa vào Pub/Sub redelivery
- **Giải pháp:** Cân nhắc exponential backoff trong subscriber

---

## PHẦN 5 — FRONTEND REVIEW

### Folder Structure ⭐⭐⭐⭐

```
frontend/src/
├── app/              # Next.js App Router pages
│   ├── catalog/      # Catalog CRUD
│   ├── customers/    # Customer CRUD
│   ├── inventory/    # Inventory management
│   ├── login/        # Auth page
│   ├── orders/       # Sales orders
│   ├── purchasing/   # Purchase orders
│   ├── page.tsx      # Dashboard
│   ├── layout.tsx    # Root layout
│   └── providers.tsx # QueryClient + AntD + Auth
├── components/
│   ├── AppShell.tsx   # Sidebar + Header layout
│   ├── StatCard.tsx   # Dashboard KPI card
│   └── customers/    # Customer-specific components
└── lib/
    ├── api/          # Centralized HTTP client + per-service modules
    ├── auth/         # AuthProvider + token management
    └── format.ts     # VND formatter, date formatter
```

### Component Design ⭐⭐⭐⭐
- **AppShell**: single layout wrapper with sidebar + breadcrumb ✅
- **Providers**: clean composition (QueryClient → ConfigProvider → AuthProvider) ✅
- **API Client**: centralized with correlation ID + auth header injection ✅

### State Management ⭐⭐⭐⭐⭐
- TanStack React Query for server state — correct choice
- `staleTime: 30_000` defaults — reasonable
- Auth state via React Context + localStorage persistence ✅

### Issues

| # | Vấn đề | File | Mức độ |
|---|---|---|:---:|
| 1 | **Dashboard page = 447 lines** — Large Component | [page.tsx](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/app/page.tsx) | 🟡 MEDIUM |
| 2 | **Hardcoded static bar chart data** (BAR_DATA) | [page.tsx:L23-31](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/app/page.tsx#L23-L31) | 🟡 MEDIUM |
| 3 | **No error boundary** for API failures | Dashboard, CRUD pages | 🟡 MEDIUM |
| 4 | **Logo from external gstatic URL** — may break | [AppShell.tsx:L117](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/components/AppShell.tsx#L117) | 🟢 LOW |
| 5 | **Hardcoded notification badge `count={3}`** | [AppShell.tsx:L166](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/components/AppShell.tsx#L166) | 🟢 LOW |
| 6 | **No lazy loading/code splitting** for pages | All pages | 🟡 MEDIUM |
| 7 | **Inline styles** instead of CSS modules | Dashboard, AppShell | 🟢 LOW |
| 8 | **`salesApi.list({ limit: 200 })`** for donut chart — expensive | [page.tsx:L103](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/app/page.tsx#L103) | 🟠 HIGH |
| 9 | **No refresh token rotation** — token expired = forced re-login | [AuthProvider.tsx](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/lib/auth/AuthProvider.tsx) | 🟡 MEDIUM |

### Accessibility
- **No explicit ARIA labels** on interactive elements
- **No keyboard navigation** testing evidence
- **Color contrast** relies on Ant Design defaults (generally OK)

### Responsive Design
- Ant Design Grid (`Row`/`Col` with `xs`, `sm`, `xl` breakpoints) ✅
- **Fixed sidebar width 240px** — no collapse on mobile ❌

---

## PHẦN 6 — DATABASE REVIEW

### Data Modeling ⭐⭐⭐⭐

**Schema per Service** (multi-schema trên cùng 1 PostgreSQL):
- `customer` schema: `cores`, `outbox`
- `inventory` schema: `stock_items`, `outbox`
- `sales` schema: (implied from sales-service prisma)
- `catalog` schema: (implied)
- `purchasing` schema: (implied)
- `auth` schema: `users`, `refresh_tokens`

### Schema Design Highlights

**Customer Schema** ([schema.prisma](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/prisma/schema.prisma)):
- ✅ `taxCode` nullable + UNIQUE (cho phép NULL cho KH cá nhân)
- ✅ `Decimal(15,2)` cho tiền VND
- ✅ Soft delete via `deletedAt`
- ✅ Index trên `deletedAt` và `createdAt`
- ✅ Outbox table với DLQ columns (`locked_until`, `attempts`, `dead_lettered_at`)

### Issues

| # | Vấn đề | Mức độ | Vị trí |
|---|---|:---:|---|
| 1 | **Missing index trên `businessName`** cho search ILIKE | 🟡 MEDIUM | Schema comment nói dùng trigram GIN nhưng raw SQL chưa verify |
| 2 | **No composite index** `(deletedAt, createdAt)` cho search query | 🟡 MEDIUM | `search()` filter `deletedAt IS NULL` + ORDER BY `createdAt DESC` |
| 3 | **`status` as String** thay vì Enum | 🟢 LOW | Flexible nhưng mất type safety ở DB level |
| 4 | **Decimal → number conversion dùng `Math.round()`** | 🟡 MEDIUM | [customer.repository.impl.ts:L88](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/src/infrastructure/persistence/customer.repository.impl.ts#L88) — OK cho VND (integer) nhưng sẽ sai nếu domain mở rộng ra USD/EUR |
| 5 | **Free tier Supabase** — connection pool limit ~20 | 🟠 HIGH | 7 services cùng kết nối 1 instance |
| 6 | **No database migration CI** — dùng `prisma db push` | 🟡 MEDIUM | [ci.yml:L130](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/.github/workflows/ci.yml#L130) — push thay vì migrate, không có rollback |

### N+1 Query Risk
- **Thấp**: Repository methods đã tối ưu (single query + Promise.all cho count+data)
- **`search()` dùng `Promise.all([count, findMany])`** — parallel execution ✅

---

## PHẦN 7 — SECURITY REVIEW

### 🔴 CRITICAL Issues

#### SEC-01: Credentials Committed to Git
- **Severity: CRITICAL**
- **File:** [backend/.env](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/.env)
- **Evidence:**
  ```
  DATABASE_URL=postgresql://postgres.tlraqjtomszfkpcjspww:JSfFr6oyqLqDhLWy@...
  UPSTASH_REDIS_REST_TOKEN="gQAAAAAAAk3hAAIgcDE3NDM0NTMw..."
  JWT_SECRET=376128eaca113ede652ab059fa2f4919eb18f17725ea6dfb1a188b1984b87985
  ```
- **Hậu quả:** Database password, Redis token, và JWT secret đang nằm trong repo. Bất kỳ ai có access repo có thể truy cập toàn bộ data.
- **Giải pháp:**
  1. **NGAY LẬP TỨC**: Rotate tất cả credentials (đổi password Supabase, regenerate Redis token, new JWT secret)
  2. Thêm `.env` vào `.gitignore` (đã có nhưng `.env` vẫn tracked)
  3. Dùng `git filter-branch` hoặc BFG Repo Cleaner xóa history
  4. Dùng secret manager (GCP Secret Manager, Vault) cho production

#### SEC-02: JWT Token Stored in localStorage
- **Severity: HIGH**
- **File:** [token.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/lib/auth/token.ts)
- **Hậu quả:** Vulnerable to XSS attacks — malicious script có thể đọc `localStorage.getItem('erp_access_token')`
- **Giải pháp:** Dùng `httpOnly` cookie cho access token. Refresh token phải luôn ở httpOnly cookie.

### 🟠 HIGH Issues

| # | Vấn đề | File | Chi tiết |
|---|---|---|---|
| SEC-03 | **No rate limiting** | API Gateway, all services | Brute-force login, DDoS |
| SEC-04 | **CORS `origin: true`** in API Gateway | [api-gateway/main.ts:L49-52](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/api-gateway/src/main.ts#L49-L52) | Allows ANY origin |
| SEC-05 | **No input sanitization** for XSS | Controllers, frontend | Raw user input rendered without encoding |
| SEC-06 | **No refresh token rotation** | AuthProvider | Refresh token reuse attack possible |

### 🟡 MEDIUM Issues

| # | Vấn đề | File |
|---|---|---|
| SEC-07 | No CSRF protection | All mutation endpoints |
| SEC-08 | `process.exit(1)` on missing JWT_SECRET | [api-gateway/main.ts:L57-58](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/api-gateway/src/main.ts#L57-L58) — crashes instead of graceful error |
| SEC-09 | User info passed as HTTP headers (`x-user-id`) | Gateway→services — headers can be spoofed if service exposed directly |
| SEC-10 | No Helmet in API Gateway | [api-gateway/main.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/api-gateway/src/main.ts) — other services have it |

### 🟢 LOW Issues

| # | Vấn đề |
|---|---|
| SEC-11 | No Content-Security-Policy (CSP) fine-tuning |
| SEC-12 | Log messages may leak business data (customer names, tax codes) |

---

## PHẦN 8 — PERFORMANCE REVIEW

### Application Performance

| Area | Status | Notes |
|---|:---:|---|
| Async/await usage | ✅ | No blocking operations |
| Connection pooling | ✅ | Prisma handles pool; Supabase PgBouncer on port 6543 |
| Cache-aside strategy | ✅ | Customer detail cached 5 min |
| Parallel queries | ✅ | `Promise.all` for count + data |

### Bottlenecks

| # | Bottleneck | Vị trí | Impact |
|---|---|---|:---:|
| 1 | **`salesApi.list({ limit: 200 })`** on dashboard | [page.tsx:L103](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/app/page.tsx#L103) | 🟠 HIGH — fetches up to 200 orders on every dashboard load |
| 2 | **Outbox polling every 2s** | [outbox-worker.service.ts:L66](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/shared/src/messaging/outbox-worker.service.ts#L66) | 🟢 LOW — acceptable for prototype |
| 3 | **ILIKE '%q%'** search (leading wildcard) | [customer.repository.impl.ts:L183](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/customer-service/src/infrastructure/persistence/customer.repository.impl.ts#L183) | 🟡 MEDIUM — seq scan on large tables |
| 4 | **`invalidatePattern()` using SCAN loop** | [redis-cache.service.ts:L106](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/shared/src/cache/redis-cache.service.ts#L106) | 🟢 LOW — only used after writes |
| 5 | **Free tier Supabase** | Global | 🟠 HIGH — connection limits, IO limits |

### Optimization Recommendations
1. **Dashboard aggregation API**: Create `GET /api/dashboard/stats` server-side instead of fetching 200 orders client-side
2. **Full-text search**: Replace ILIKE with PostgreSQL `tsvector` or trigram GIN index
3. **Connection pooling awareness**: Each service should configure `connection_limit` in Prisma

---

## PHẦN 9 — TESTING REVIEW

### Test Coverage

| Service | Unit Tests | Integration Tests | E2E Tests |
|---|:---:|:---:|:---:|
| `@erp/shared` | ❌ | — | — |
| `customer-service` | ✅ 8 files | ✅ Repository + E2E | ✅ |
| `inventory-service` | ✅ | ✅ Concurrent locking | — |
| `sales-service` | ❌ | ❌ | ❌ |
| `auth-service` | ❌ (scaffold only) | ❌ | ❌ |
| `catalog-service` | ❌ | ❌ | ❌ |
| `purchasing-service` | ❌ | ❌ | ❌ |
| Frontend | ❌ | ❌ | ❌ |

### Test Quality (customer-service)
- **Unit tests** cho entity, value objects, commands, queries ✅
- **UUID mocking** (`uuid-mock.js`) for deterministic tests ✅
- **Integration tests** with real Postgres (CI service container) ✅
- **Coverage threshold** enforced in CI ✅

### Gaps

| Gap | Priority | Recommendation |
|---|:---:|---|
| **Zero tests cho shared library** | 🟠 HIGH | Idempotency, outbox worker, cache cần unit tests |
| **Zero tests cho sales/catalog/purchasing/auth** | 🟠 HIGH | Ít nhất unit test cho domain logic |
| **No frontend tests** | 🟡 MEDIUM | Component tests (React Testing Library) cho critical flows |
| **No contract tests** | 🟡 MEDIUM | Verify event payload contracts between services |
| **No performance/load tests** | 🟢 LOW | Acceptable cho prototype |

---

## PHẦN 10 — DEVOPS REVIEW

### Build Pipeline ⭐⭐⭐⭐

**CI/CD** ([ci.yml](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/.github/workflows/ci.yml)):
- ✅ Lint (strict, no auto-fix) → hard gate
- ✅ Build (typecheck) → hard gate
- ✅ Unit test + coverage threshold
- ✅ Integration test with Postgres service container
- ✅ Concurrency control (`cancel-in-progress: true`)

### Issues

| # | Vấn đề | Mức độ |
|---|---|:---:|
| 1 | **No Dockerfile** per service | 🟡 MEDIUM |
| 2 | **No production docker-compose** | 🟡 MEDIUM |
| 3 | ~~`docker-compose.dev.yml` runs `npm ci` on every startup~~ | ✅ RESOLVED — file removed, dev uses native `npm run dev:all` |
| 4 | **No staging/production environment** | 🟠 HIGH |
| 5 | **No deployment pipeline** (only CI, no CD) | 🟡 MEDIUM |
| 6 | **`prisma db push` instead of `prisma migrate deploy`** | 🟡 MEDIUM — no migration history |
| 7 | **No rollback strategy** | 🟠 HIGH |
| 8 | **CI chỉ test customer + inventory** — 5 services khác bỏ qua | 🟡 MEDIUM |

### Infrastructure

| Component | Dev | Production |
|---|:---:|:---:|
| PostgreSQL | Supabase free | ❌ Not planned |
| Redis | Upstash free | ❌ Not planned |
| Pub/Sub | Docker emulator | ❌ No GCP setup |
| API Gateway | Docker | ❌ No cloud deploy |
| Frontend | `next dev` | ❌ No build/deploy |

---

## PHẦN 11 — SRE REVIEW

### Monitoring ⭐⭐⭐⭐
- **Custom metrics** (Prometheus format): `events_published_total`, `outbox_pending`, `events_publish_failed_total`, `events_dead_lettered_total` ✅
- **`GET /metrics`** endpoint with optional Bearer auth ✅
- **Health checks**: `/health` (readiness) + `/health/live` (liveness) with timeout ✅

### Logging ⭐⭐⭐⭐
- **StructuredLogger**: JSON format with correlationId ✅
- **AsyncLocalStorage**: automatic correlation propagation ✅

### Gaps

| Hạng mục | Status |
|---|:---:|
| Prometheus/Grafana setup | ❌ |
| Alerting rules | ❌ |
| Distributed tracing (Jaeger/Zipkin) | ❌ (correlation ID is manual) |
| SLA/SLO/SLI defined | ❌ |
| Backup strategy | ❌ (relies on Supabase) |
| Disaster recovery plan | ❌ |
| Incident handling runbook | ❌ |
| Log aggregation (ELK/Loki) | ❌ |

---

## PHẦN 12 — UI/UX REVIEW

### Visual Consistency ⭐⭐⭐⭐
- Ant Design 5 provides consistent design language ✅
- Custom theme token (`colorPrimary: '#1677ff'`) ✅
- Vietnamese locale (`viVN`) ✅

### Layout ⭐⭐⭐⭐
- Fixed sidebar (240px) + sticky header ✅
- Breadcrumb navigation ✅
- Content area with proper padding ✅

### Issues

| # | Vấn đề | Mức độ |
|---|---|:---:|
| 1 | **No mobile responsive sidebar** (fixed 240px, no collapse) | 🟡 MEDIUM |
| 2 | **Dashboard chart = CSS-only** (no chart library) | 🟢 LOW |
| 3 | **External logo image** (gstatic URL, unreliable) | 🟢 LOW |
| 4 | **No dark mode** | 🟢 LOW |
| 5 | **Customer ID truncated** (`slice(0,8)`) in orders table — confusing | 🟢 LOW |
| 6 | **No empty state illustrations** | 🟢 LOW |

---

## PHẦN 13 — DESIGN PATTERN REVIEW

### Patterns Đã Áp Dụng (Tốt)

| Pattern | Áp dụng | Đánh giá |
|---|---|---|
| **Repository** | Domain port → Prisma adapter | ⭐⭐⭐⭐⭐ Textbook implementation |
| **Outbox** | Transaction(data + event) → worker polls → publish | ⭐⭐⭐⭐⭐ With DLQ + SKIP LOCKED |
| **CQRS-lite** | Separate Command/Query classes | ⭐⭐⭐⭐ Good foundation |
| **Value Object** | TaxCode VO (immutable, self-validating) | ⭐⭐⭐⭐⭐ |
| **Cache-Aside** | Redis cache in queries | ⭐⭐⭐⭐ |
| **Idempotent Consumer** | 2-state Redis dedup | ⭐⭐⭐⭐⭐ Excellent |
| **Optimistic Locking** | Version column + retry | ⭐⭐⭐⭐⭐ |
| **Adapter** | PrismaOutboxStore adapts OutboxStore interface | ⭐⭐⭐⭐⭐ |
| **Saga (Choreography)** | Sales → Pub/Sub → Inventory → Pub/Sub → Sales | ⭐⭐⭐⭐ |

### Pattern Recommendations

#### 1. Specification Pattern → Search Filters
- **Vấn đề:** `search()` method hardcodes filter logic (`businessName ILIKE ...`)
- **Pattern:** Specification
- **Lý do:** Khi thêm filter (status, date range, credit limit) → method sẽ phình
- **Lợi ích:** Composable filters, testable, reusable
- **Ví dụ:** `new ActiveCustomerSpec().and(new NameContainsSpec(query))`

#### 2. Strategy Pattern → Event Payload Builder
- **Vấn đề:** Outbox payload hardcoded inline trong repository `save()` method
- **Pattern:** Strategy
- **Lý do:** Mỗi event type có payload khác nhau, hiện nằm scattered trong repository code
- **Lợi ích:** Centralize payload construction, dễ test payload format

#### 3. Facade Pattern → Dashboard Aggregation
- **Vấn đề:** Frontend gọi 3 API riêng rồi tính toán KPI client-side
- **Pattern:** Facade (Backend-for-Frontend)
- **Lý do:** 1 API call thay vì 4
- **Lợi ích:** Giảm latency, giảm tải client, server-side caching dễ hơn

---

## PHẦN 14 — DOCUMENTATION REVIEW

### Chấm điểm

| Document | Score | Comments |
|---|:---:|---|
| **README** | ⭐⭐⭐⭐ | Clear, honest about status. Quick start works. |
| **IMPLEMENTATION-STATUS.md** | ⭐⭐⭐⭐⭐ | Excellent source of truth — rare to see in projects |
| **API Documentation** | ⭐⭐⭐⭐ | Docs now match implementation; all endpoints documented and working |
| **Architecture Documentation** | ⭐⭐⭐ | Sequence diagrams, data model exist but may be stale |
| **Setup Guide** | ⭐⭐⭐⭐ | Docker Compose dev setup works |
| **Deployment Guide** | ⭐ | None exists |
| **ADR (Architecture Decision Records)** | ⭐⭐⭐⭐ | Referenced in docs (ADR-009, ADR-010) |
| **Code Comments** | ⭐⭐⭐⭐⭐ | Extremely thorough — excellent for learning |

### Onboarding Assessment

| Criteria | Score |
|---|:---:|
| Thời gian setup (dev environment) | ~30 phút (with Docker) ✅ |
| Khả năng tự chạy dự án | ⭐⭐⭐⭐ (clear instructions) |
| Khả năng tự deploy | ⭐ (no deployment docs) |
| Mức độ phụ thuộc người cũ | ⭐⭐⭐ (good docs but complex architecture) |

---

## PHẦN 15 — PRODUCT REVIEW

### Feature Completeness

| Feature | Status |
|---|:---:|
| Customer CRUD | ✅ |
| Customer credit check | ✅ |
| Sales order lifecycle (draft→submitted→confirmed→fulfilled) | ✅ |
| Sales order saga (inventory reservation) | ✅ |
| Inventory management (receive/reserve/release/issue) | ✅ |
| Product catalog CRUD | ✅ |
| Purchase order lifecycle | ✅ |
| Goods receipt → Inventory | ✅ |
| User auth (login/register) | ✅ |
| RBAC (role-based access) | Partial |
| Dashboard with real data | ✅ |
| Search + Pagination | ✅ |
| Reporting | ❌ |
| Audit trail | ❌ |
| Multi-tenancy | ❌ |

### Business Logic Issues
1. **Revenue calculation on dashboard** sums only visible page (5 orders), not all-time — misleading
2. **Credit check is synchronous HTTP** — if customer-service down, order creation fails
3. **No order cancellation compensation** for credit used (credit adjustment after cancel)

---

## PHẦN 16 — ENGINEERING MANAGEMENT REVIEW

### Code Ownership
- **Single contributor** (learning project) — no code review process
- **No CODEOWNERS file**

### Branch Strategy
- CI on `main` and PR to `main`
- No evidence of feature branches, staging branches

### Bus Factor: ⚠️ **1**
- Toàn bộ knowledge nằm ở 1 người
- Mitigated partially by excellent code comments + documentation

### Technical Debt Management
- ✅ **IMPLEMENTATION-STATUS.md** tracks what's done vs blueprint
- ✅ **improvement-plan.md** exists as roadmap
- ❌ No tech debt tracking system (GitHub Issues, JIRA)

---

## PHẦN 17 — STAFF ENGINEER REVIEW

### Long-term Architecture Assessment

| Timeline | Risk |
|---|---|
| **Now** | Prototype works. Architecture proves DDD/Event-Driven concepts. |
| **1 năm** | If this goes to production: single DB will become bottleneck. Free tier limits will be hit. Need database-per-service migration. |
| **3 năm** | Schema evolution across 7 services will require versioned APIs + CDC (Change Data Capture). Outbox polling should migrate to Debezium/WAL. Kubernetes for orchestration. |
| **5 năm** | Consider CQRS with separate read models, event sourcing for audit trail, multi-region deployment. Evaluate moving from NestJS to more performant runtime for hot paths. |

### Architectural Bottleneck
1. **Shared database** → split when scaling (top priority)
2. **No API gateway caching** → add CDN/edge caching
3. **Synchronous credit check** → async event + eventual consistency

### Team Scalability
- Current DDD structure supports team split by bounded context ✅
- Shared lib provides foundation for new services ✅
- Need: Terraform/IaC, proper CI/CD, observability stack

---

## 🔴 Critical Issues

### CRIT-01: Credentials in Git Repository
- **Mô tả:** Database password, Redis token, JWT secret committed to `.env` file
- **Vị trí:** [backend/.env](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/backend/.env)
- **Nguyên nhân:** `.env` file tracked in git despite `.gitignore` existing
- **Hậu quả:** Full database access, cache access, token forgery for anyone with repo access
- **Giải pháp:** Rotate all credentials immediately, remove from git history, use secret manager

### CRIT-02: JWT in localStorage (XSS Vulnerability)
- **Mô tả:** Access + refresh tokens stored in `localStorage`
- **Vị trí:** [token.ts](file:///d:/Private_Space/Wecare/New-ERP-GG-Cloud/erp-prototype-example/frontend/src/lib/auth/token.ts)
- **Nguyên nhân:** Simpler implementation choice
- **Hậu quả:** Any XSS attack can steal authentication tokens
- **Giải pháp:** Use `httpOnly` cookies for token storage, add CSRF token

---

## 🟠 High Priority Improvements

1. **Rotate all leaked credentials** and remove from git history
2. **Add rate limiting** (express-rate-limit) to API Gateway and auth endpoints
3. **Fix CORS** — whitelist specific origins instead of `origin: true` on gateway
4. **Add circuit breaker** for inter-service HTTP calls (sales → customer)
5. **Create dashboard aggregation API** instead of fetching 200 orders client-side
6. **Add unit tests for `@erp/shared` library** — critical infrastructure untested
7. **Add tests for sales/catalog/purchasing services**
8. **Fix mobile responsive sidebar** in AppShell

---

## 🟡 Medium Priority Improvements

1. **Encapsulate entity properties** — make fields private, expose via methods
2. **Add API versioning** (`/v1/customers`)
3. **Replace `prisma db push` with `prisma migrate`** for migration history
4. **Add error boundaries** in frontend
5. **Implement refresh token rotation**
6. **Add request timeout** for HTTP calls between services
7. **Remove dead code** (scaffold files in auth/sales services)
8. **Add composite index** `(deletedAt, createdAt)` for search queries
9. **Add Helmet to API Gateway**
10. **Create Dockerfiles** for each service

---

## 🟢 Good Practices Found

1. ✅ **Excellent DDD layer separation** — domain completely independent of infrastructure
2. ✅ **Outbox Pattern** implementation with DLQ, SKIP LOCKED, retry — production-grade
3. ✅ **Idempotent Consumer** 2-state mechanism — crash-safe, superior to simple flag
4. ✅ **Dependency Inversion** via token injection throughout all services
5. ✅ **Event Envelope** with versioning + dedup eventId — forward-looking design
6. ✅ **Correlation ID** propagation via AsyncLocalStorage — excellent observability
7. ✅ **Health checks** with timeout + liveness/readiness separation — K8s-ready
8. ✅ **Transaction-based mutations** — all writes are atomic (data + outbox)
9. ✅ **Optimistic Locking** in inventory with retry/backoff — prevents lost updates
10. ✅ **IMPLEMENTATION-STATUS.md** — honest project tracking, rare and valuable
11. ✅ **CI pipeline** with strict lint + typecheck + coverage threshold
12. ✅ **Integration tests** with real Postgres service container
13. ✅ **Generic shared library** — DRY, each service adds thin adapter
14. ✅ **Cache error handling** — cache failures don't crash the app (graceful degradation)
15. ✅ **Centralized API client** on frontend with correlation ID + auth injection

---

## ⭐ Top 20 Refactoring Recommendations

| # | Vấn đề | Giải pháp | Độ khó | Impact |
|---|---|---|:---:|:---:|
| 1 | Credentials in git | Rotate + remove history + secret manager | Easy | **High** |
| 2 | JWT in localStorage | HttpOnly cookies + CSRF | Medium | **High** |
| 3 | No rate limiting | Add `express-rate-limit` to gateway | Easy | **High** |
| 4 | CORS `origin: true` on gateway | Whitelist specific origins | Easy | **High** |
| 5 | Dashboard fetches 200 orders | Create BFF aggregation endpoint | Medium | **High** |
| 6 | No circuit breaker | Add `opossum` to inter-service HTTP | Medium | **High** |
| 7 | Entity properties public | Make private + domain methods | Medium | **Medium** |
| 8 | `@erp/shared` untested | Add unit tests for outbox, idempotency, cache | Medium | **High** |
| 9 | No API versioning | Add `/v1/` prefix to all routes | Easy | **Medium** |
| 10 | `prisma db push` | Switch to `prisma migrate` | Easy | **Medium** |
| 11 | No error boundary (FE) | Add React Error Boundary + fallback UI | Easy | **Medium** |
| 12 | No refresh token rotation | Implement silent refresh + rotation | Medium | **Medium** |
| 13 | ILIKE leading wildcard search | Add trigram GIN index or `tsvector` | Medium | **Medium** |
| 14 | No mobile sidebar collapse | Add responsive drawer mode | Easy | **Medium** |
| 15 | Vietnamese log messages | Switch to English for all structured logs | Easy | **Low** |
| 16 | Dead scaffold files | Remove `app.controller.ts`, `app.service.ts` from auth/sales | Easy | **Low** |
| 17 | Missing composite index | Add `@@index([deletedAt, createdAt])` | Easy | **Medium** |
| 18 | No Helmet on API Gateway | Add `app.use(helmet())` | Easy | **Medium** |
| 19 | No Dockerfiles per service | Create multi-stage Dockerfiles | Medium | **Medium** |
| 20 | Dashboard 447-line monolith | Split into sub-components (KPICards, Charts, Tables) | Easy | **Low** |

---

## 🚀 Production Readiness Score

| Category | Score | Rationale |
|---|:---:|---|
| **Architecture** | **8**/10 | Excellent DDD/Event-Driven foundation. Single DB is the only gap. |
| **Code Quality** | **8**/10 | Clean, well-structured, great naming. Minor encapsulation issues. |
| **Backend** | **7**/10 | Solid patterns. Missing rate limit, circuit breaker, timeout. |
| **Frontend** | **6**/10 | Functional but needs error handling, a11y, responsive sidebar. |
| **Database** | **7**/10 | Good schema design. Missing some indexes, free tier risk. |
| **Security** | **3**/10 | Critical: credentials in git, JWT in localStorage, no rate limit. |
| **Performance** | **6**/10 | Acceptable for prototype. Dashboard 200-order fetch is wasteful. |
| **Testing** | **5**/10 | Customer+Inventory well tested. 5 other services untested. |
| **DevOps** | **4**/10 | CI exists. No CD, no Dockerfiles, no staging, no rollback. |
| **Documentation** | **7**/10 | Excellent code comments + status tracking. Missing deploy docs. |
| **Maintainability** | **8**/10 | DDD structure + shared lib make changes very manageable. |
| **Scalability** | **5**/10 | Single DB bottleneck. Outbox polling. Free tier limits. |

### Total Score: **74 / 120 → Normalized: 62 / 100**

> [!IMPORTANT]
> **Verdict: NOT production-ready** — primarily due to security issues (credentials in git, JWT storage) and missing DevOps infrastructure. However, the **architecture and code quality are excellent for a learning prototype** and provide a solid foundation for production evolution.

> [!TIP]
> **Quick wins to reach 75+:** Fix SEC-01 (credentials), SEC-02 (JWT storage), add rate limiting, and add tests for shared library. These 4 changes would raise Security from 3→6 and Testing from 5→7, gaining ~12 points.
