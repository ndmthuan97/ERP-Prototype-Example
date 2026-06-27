---
type: System Component
title: "System Architecture Overview"
description: "Overall system architecture: service map, tech stack, request flows, DDD layer structure, and @erp/shared library"
tags: [system, component, architecture, microservices]
timestamp: "2026-06-25T00:00:00+07:00"
---

# System Overview — Kiến trúc tổng quan

> ✅ **Trạng thái:** Tất cả 7 backend services + API Gateway + Frontend đã implement đầy đủ. Xem [Implementation Status](../IMPLEMENTATION-STATUS.md).

> Tài liệu mô tả kiến trúc tổng thể của ERP Prototype.
> Liên quan: [bounded-contexts](bounded-contexts.md) · [data-model](data-model.md) · [event-flows](event-flows.md) · [design-patterns](design-patterns.md)

---

## 1. Sơ đồ kiến trúc tổng thể

```mermaid
flowchart TB
    Browser["Browser"]
    FE["Frontend :3000"]
    GW["API Gateway :3010  (JWT + RBAC)"]

    Auth["Auth :3004"]
    Cust["Customer :3001"]
    Ord["Sales :3002"]
    Inv["Inventory :3003"]
    Cat["Catalog :3005"]
    Pur["Purchasing :3006"]

    DB[("Supabase PostgreSQL — 8 schemas")]
    PS["Pub/Sub Emulator :8085"]
    RD[("Upstash Redis")]

    Browser --> FE
    FE -- "HTTP" --> GW

    GW -- "verify" --> Auth
    GW --> Cust
    GW --> Ord
    GW --> Inv
    GW --> Cat
    GW --> Pur

    Auth --> DB
    Cust --> DB
    Ord --> DB
    Inv --> DB
    Cat --> DB
    Pur --> DB

    Cust -- "publish" --> PS
    Ord -- "publish" --> PS
    Inv -- "publish" --> PS
    Pur -- "publish" --> PS

    PS -. "subscribe" .-> Ord
    PS -. "subscribe" .-> Inv

    Cust -. "cache" .-> RD
```

**Đọc sơ đồ:**
- **Đường liền** (→) = HTTP request
- **Đường đứt** (-.→) = event subscribe / cache
- Tất cả services nối thẳng xuống DB — mỗi service chỉ truy cập schema của mình
- Pub/Sub: 4 services publish events, Sales + Inventory subscribe lẫn nhau (Saga)

---

## 2. Tech Stack

| Layer | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | Next.js 15, React 19 | SPA với App Router, SSR-ready |
| **UI Library** | Ant Design 5 | Complex components (Table, Form, Steps, Timeline) |
| **CSS** | Tailwind CSS | Utility spacing, layout, responsive |
| **Charts** | Recharts | Dashboard biểu đồ |
| **Animation** | Framer Motion | Micro-animations, page transitions |
| **Form** | React Hook Form + Zod | Form validation |
| **Data Fetching** | TanStack React Query | Cache, refetch, mutations |
| **Backend** | NestJS (TypeScript) | Framework có cấu trúc DDD (modules, DI, guards) |
| **ORM** | Prisma (code-first) | Schema → Migration → DB tables |
| **Auth** | bcrypt + jsonwebtoken | Hash password, sign/verify JWT |
| **Database** | Supabase PostgreSQL | Cloud PostgreSQL (free tier, 500MB) |
| **Cache** | Upstash Redis | Cloud Redis (free tier, REST API) |
| **Message Queue** | GCP Pub/Sub Emulator | Event-driven communication (Docker container) |
| **Container** | Docker | Chỉ chạy Pub/Sub Emulator |

---

## 3. Service Map — 5 services

| **API Gateway** | 3010 | — | JWT Guard, RBAC, Reverse Proxy |
| **Auth Service** | 3004 | `app_auth` | bcrypt, JWT, Refresh Token |
| **Customer Service** | 3001 | `customer` | DDD layers, Repository, Value Object, Outbox |
| **Sales Service** | 3002 | `sales` | Aggregate Root, Saga, CQRS, Outbox |
| **Inventory Service** | 3003 | `inventory` | Optimistic Locking, CHECK constraint, Outbox |
| **Catalog Service** | 3005 | `catalog` | Product CRUD, SKU VO, taxRate, Outbox |
| **Purchasing Service** | 3006 | `purchasing` | PO lifecycle, Supplier, Outbox |

---

## 4. Cross-Reference — Chi tiết chuyên sâu

Các nội dung chi tiết nằm ở docs chuyên biệt:

| Chủ đề | Xem tại |
|--------|--------|
| **JWT Authentication Flow** | [rbac.md](rbac.md) §3 — JWT Guard Flow |
| **Saga / Submit Flow** | [event-flows.md](event-flows.md) §4 — Order Submit Flow |
| **Database Schemas** | [data-model.md](data-model.md) — ER diagrams, table definitions |
| **Outbox Pattern** | [design-patterns.md](design-patterns.md) §5 — Transactional event publishing |
| **RBAC Matrix** | [rbac.md](rbac.md) §4 — Permission matrix |
| **Deployment / Startup** | [getting-started.md](../development/getting-started.md) |
| **Patterns × Services** | [design-patterns.md](design-patterns.md) §0 — Tổng quan 14 patterns |
| **Per-service details** | [services/](../services/index.md) — Quick reference per service |

---

## 11. `@erp/shared` — Cross-cutting Infrastructure Package

5 services (Customer, Order, Inventory, Auth, Gateway) cần các primitives giống hệt: outbox worker, idempotency, cache, logger, health check, metrics, event contracts. Thay vì copy-paste → tất cả nằm trong **1 package dùng chung**: `@erp/shared`.

### Sơ đồ 6 Modules

```mermaid
flowchart TB
    SHARED["@erp/shared"]

    subgraph contracts
        EVT["EVENT const + Payload interfaces"]
    end

    subgraph messaging
        OW["OutboxWorkerService"]
        PSP["PubSubPublisher"]
        IDP["withIdempotency()"]
    end

    subgraph cache
        RCS["RedisCacheService"]
    end

    subgraph observability
        COR["CorrelationMiddleware"]
        LOG["StructuredLogger"]
        HLT["HealthController"]
        MET["MetricsService"]
    end

    subgraph config
        ENV["getRequiredEnv / getEnv"]
    end

    subgraph persistence
        PRS["resolveConnectionString()"]
    end

    SHARED --> contracts
    SHARED --> messaging
    SHARED --> cache
    SHARED --> observability
    SHARED --> config
    SHARED --> persistence
```

### Bảng tổng hợp modules

| Module | Files chính | Mục đích | Dùng bởi |
|---|---|---|---|
| **contracts** | `events.ts` | `EVENT` const (topic names), typed payload interfaces, `EventMetadata` | Tất cả services publish/subscribe |
| **messaging** | `outbox-worker.service.ts`, `pubsub-publisher.ts`, `idempotency.ts` | Outbox worker generic, Pub/Sub publisher với topic cache, idempotent consumer helper | Customer, Order, Inventory |
| **cache** | `redis-cache.service.ts` | Cache-Aside qua Upstash Redis REST API: `get/set/del/invalidatePattern` | Tất cả services cần cache |
| **observability** | `correlation.ts`, `logger.ts`, `health.ts`, `metrics.ts` | CorrelationId (AsyncLocalStorage), JSON logger, health check endpoint, Prometheus metrics | Tất cả services |
| **config** | `env.ts` | Đọc biến môi trường an toàn (fail-fast khi thiếu) | Tất cả services |
| **persistence** | `prisma-connection.ts` | Lấy connection string: ưu tiên pooled URL, fallback direct | Customer, Order, Inventory |

### Quan hệ giữa các files trong mỗi module

> **Cách đọc**: Theo số thứ tự trên mũi tên (①→②→③...). Đường liền = gọi trực tiếp. Đường đứt = implement/gián tiếp. Hình trụ = database/store.

#### messaging — Outbox → Publish → Dedup

```mermaid
flowchart TB
    subgraph "shared/messaging"
        OS_IF["OutboxStore\n(interface)"]
        OW["OutboxWorkerService\n⏱️ poll mỗi 2s"]
        PSP["PubSubPublisher"]
        IDP["withIdempotency()"]
    end

    subgraph "Service cục bộ"
        POS["PrismaOutboxStore\n(adapter)"]
        SUB["Event Subscriber"]
    end

    subgraph External
        DB[("PostgreSQL")]
        PS["Pub/Sub"]
        RD[("Redis")]
    end

    POS -. "implements" .-> OS_IF
    OW -- "① @Inject\nOutboxStore" --> OS_IF
    POS -- "② query outbox\nWHERE published_at IS NULL" --> DB
    OW -- "③ publish(eventType, payload)" --> PSP
    PSP -- "④ topic.publishMessage()" --> PS
    PS -- "⑤ deliver message" --> SUB
    SUB -- "⑥ wraps handler" --> IDP
    IDP -- "⑦ SET NX EX 86400" --> RD
```

| Bước | Chức năng |
|:---:|---|
| ① | Worker inject `OutboxStore` qua DI token → nhận adapter Prisma do service bind |
| ② | Adapter query bảng `outbox` trong PostgreSQL → lấy events chưa publish (`published_at IS NULL`) |
| ③ | Worker gọi `PubSubPublisher.publish()` với eventType + payload |
| ④ | Publisher gửi message lên Pub/Sub topic (auto-create topic nếu lần đầu) |
| ⑤ | Pub/Sub deliver message cho subscriber ở service khác |
| ⑥ | Subscriber bọc handler bằng `withIdempotency()` trước khi chạy business logic |
| ⑦ | Idempotency check Redis: `SET processed:{eventId} NX EX 86400` — nếu key đã tồn tại → bỏ qua (dedup) |

#### contracts — Event naming + typed payloads

```mermaid
flowchart LR
    EVT["events.ts\n─────────\nEVENT const\nPayload interfaces\nEventMetadata"]

    PUB["① Producer\n(outbox.create)"]
    SUB["② Consumer\n(subscriber)"]

    PUB -- "import EVENT + Payload" --> EVT
    SUB -- "import EVENT + Payload" --> EVT
```

| Bước | Chức năng |
|:---:|---|
| ① | Producer (vd: order-service) import `EVENT.ORDER_SUBMITTED` + `OrderSubmittedPayload` để ghi outbox đúng schema |
| ② | Consumer (vd: inventory-service) import cùng tên event + cùng payload type để parse message đúng kiểu |

> Cả 2 phía import từ **cùng 1 file** → sai tên/field = compile error.

#### cache — Cache-Aside + shared Redis client

```mermaid
flowchart LR
    SVC["① Service\nget/set/del"]
    IDP["② withIdempotency\ngetClient()"]
    HLT["③ HealthController\nping()"]

    RCS["RedisCacheService"]
    RD[("Upstash Redis")]

    SVC -- "Cache-Aside" --> RCS
    IDP -- "dùng chung client" --> RCS
    HLT -- "health check" --> RCS
    RCS -- "HTTP REST API" --> RD
```

| Bước | Chức năng |
|:---:|---|
| ① | Service (query/command) gọi `get/set/del/invalidatePattern` — đọc cache trước, miss thì query DB rồi ghi cache |
| ② | `withIdempotency()` gọi `getClient()` để lấy raw Redis client — dùng cho `SET NX` (dedup message) |
| ③ | `HealthController` gọi `ping()` — kiểm tra Redis còn phản hồi không, trả kết quả trong `GET /health` |

> 3 consumer hội tụ vào 1 instance `RedisCacheService` → dùng chung 1 connection.

#### observability — 2 luồng độc lập

```mermaid
flowchart TB
    subgraph "Luồng A: Truy vết"
        REQ["① HTTP Request\nx-correlation-id"]
        COR["② CorrelationMiddleware\nAsyncLocalStorage lưu ID"]
        LOG["③ StructuredLogger\ntự đính correlationId"]
        SVC["④ Business code\nlog có correlationId tự động"]
    end

    subgraph "Luồng B: Monitoring"
        APP["Ⓐ AppModule\nbind HEALTH_INDICATORS"]
        HLT["Ⓑ HealthController\nGET /health → 200|503"]
        MET["Ⓒ MetricsController\nGET /metrics → Prometheus"]
        BIZ["Ⓓ Business code\ninc() / setGauge()"]
    end

    REQ --> COR --> LOG --> SVC
    APP --> HLT
    BIZ --> MET
```

**Luồng A — Truy vết** (đọc ①→④):

| Bước | Chức năng |
|:---:|---|
| ① | HTTP request đến, mang header `x-correlation-id` (hoặc middleware sinh UUID mới nếu thiếu) |
| ② | `CorrelationMiddleware` lưu ID vào `AsyncLocalStorage` — mọi code async trong request đọc được ID này |
| ③ | `StructuredLogger` tự lấy ID từ AsyncLocalStorage, đính vào mỗi dòng log JSON (`"correlationId":"abc-123"`) |
| ④ | Business code gọi `logger.log()` bình thường — correlationId tự có, không cần truyền tay |

**Luồng B — Monitoring** (đọc Ⓐ→Ⓓ):

| Bước | Chức năng |
|:---:|---|
| Ⓐ | `AppModule` bind mảng `HealthIndicator[]` vào token `HEALTH_INDICATORS` (vd: check Postgres + Redis) |
| Ⓑ | `HealthController` expose `GET /health` — chạy tất cả indicators, trả `200 ok` hoặc `503 down` |
| Ⓒ | `MetricsController` expose `GET /metrics` — xuất tất cả counter/gauge dạng Prometheus text |
| Ⓓ | Business code gọi `metrics.inc('events_published_total')` hoặc `metrics.setGauge('outbox_pending', n)` tại các điểm quan trọng |

#### config + persistence — Bootstrap helpers

```mermaid
flowchart LR
    BOOT["① Service khởi động\n(main.ts)"]
    ENV["② getRequiredEnv()\ngetEnv() / getEnvNumber()"]
    PENV[("③ process.env")]

    PRS["② resolveConnectionString()"]
    DB[("③ PostgreSQL")]

    BOOT -- "đọc config" --> ENV -- "lookup" --> PENV
    ENV -. "throw nếu thiếu" .-> BOOT
    BOOT -- "kết nối DB" --> PRS -- "RUNTIME_DATABASE_URL\nfallback DATABASE_URL" --> PENV
    PRS -. "connection string" .-> DB
```

| Bước | Chức năng |
|:---:|---|
| ① | Service khởi động (`main.ts` / `PrismaService` constructor) — cần config + DB connection |
| ② | `getRequiredEnv()` đọc biến bắt buộc (throw ngay nếu thiếu). `resolveConnectionString()` ưu tiên `RUNTIME_DATABASE_URL` (pooled), fallback `DATABASE_URL` (direct) |
| ③ | Giá trị lấy từ `process.env` → dùng để kết nối PostgreSQL |

### Barrel Export

Mọi service chỉ cần 1 import duy nhất:

```typescript
import {
  EVENT, CustomerCreatedPayload,       // contracts
  OutboxWorkerService, withIdempotency, // messaging
  RedisCacheService,                    // cache
  StructuredLogger, HealthController,   // observability
  getRequiredEnv,                       // config
  resolveConnectionString,              // persistence
} from '@erp/shared';
```

Xem chi tiết API và cách dùng: [design-patterns](design-patterns.md) (patterns 5, 6, 12–14) · [coding-standards](../development/coding-standards.md) (sections 8–9)

