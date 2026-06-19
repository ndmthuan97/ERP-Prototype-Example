# New ERP Prototype — Development Plan

> **Mục tiêu**: Validate 6 architectural patterns (DDD, Event-driven, CQRS, Outbox, Saga, Aggregate Root) qua 3 bounded contexts (Customer, Order, Inventory).
> **Đây là project để HỌC** — mỗi bước giải thích _tại sao_ làm, _pattern nào_ đang validate, và _concept gì_ cần nắm.

> [!IMPORTANT]
> **Quy tắc comment code**: Tất cả inline comments trong source code phải viết bằng **tiếng Việt**.
> Giải thích chi tiết từng đoạn code để người đọc hiểu rõ logic, pattern, và lý do tại sao code như vậy.
> Đây là project học — comment càng chi tiết càng tốt.

> [!IMPORTANT]
> **Clean Code & SOLID**: Toàn bộ source code phải tuân thủ:
>
> **Clean Code:**
> - Tên biến/hàm/class phải rõ nghĩa, tự giải thích (self-documenting)
> - Mỗi hàm chỉ làm MỘT việc (single responsibility ở function level)
> - Hàm ngắn, tối đa 20-30 dòng. Dài hơn → tách
> - Không magic number — dùng constants có tên rõ ràng
> - Không nested if quá 2 levels — dùng early return / guard clause
> - Không code trùng lặp — DRY (Don't Repeat Yourself)
>
> **SOLID:**
> - **S** — Single Responsibility: Mỗi class chỉ có 1 lý do để thay đổi
> - **O** — Open/Closed: Mở cho mở rộng, đóng cho sửa đổi (dùng interface, strategy)
> - **L** — Liskov Substitution: Subclass thay thế được parent mà không break
> - **I** — Interface Segregation: Interface nhỏ, chuyên biệt (không force implement method không dùng)
> - **D** — Dependency Inversion: Module cấp cao không phụ thuộc module cấp thấp → cả hai phụ thuộc abstraction (interface)
>
> Áp dụng đặc biệt rõ ở: Domain layer (entity thuần, không biết DB), Repository interface (D), Command/Query tách biệt (S, I).

---

## Tóm tắt quyết định

| Quyết định | Lựa chọn |
|---|---|
| **Mục tiêu** | Validate kiến trúc core — chứng minh 6 patterns hoạt động đúng |
| **Bounded contexts** | Customer + Order + Inventory ("golden triangle") |
| **Infrastructure** | **Supabase** (PostgreSQL cloud) + **Upstash** (Redis cloud) + **Pub/Sub Emulator** (Docker) |
| **Tech stack** | NestJS (TypeScript) + Prisma (code-first) + `@google-cloud/pubsub` |
| **Repo structure** | 1 repo: `backend/` (5 NestJS services + package `@erp/shared`) và `frontend/` (Next.js). Service dùng `@erp/shared` qua `file:` dependency — **KHÔNG** npm workspaces (mỗi service có Prisma Client riêng, workspace hoisting sẽ đụng độ generated client) |
| **UI** | Next.js 15 + Ant Design 5 + Tailwind CSS + TanStack Table + Recharts + Framer Motion |
| **ORM** | Prisma code-first — `prisma migrate dev` tạo tables. `DATABASE_URL` (pooled) cho runtime + `DIRECT_URL` (direct) cho migrate |
| **Database** | Supabase PostgreSQL (free tier), 4 schemas (auth, customer, order, inventory). **Shared DB**: mỗi service có `_prisma_migrations` riêng trong schema của mình → không drift |
| **Cache** | Upstash Redis (free tier) — cache + **idempotency store** cho Pub/Sub consumers (dedup at-least-once delivery) |
| **Message Queue** | GCP Pub/Sub Emulator (Docker container) |
| **API Gateway** | NestJS gateway — frontend chỉ gọi gateway, gateway route đến services |
| **Auth** | Tự code — auth-service riêng (bcrypt + JWT), 3 roles: admin/manager/staff, gateway verify JWT |
| **Shared code** | Package `@erp/shared` — event contracts (typed), Outbox Worker dùng chung, idempotency helper, PrismaService/Redis base, observability primitives. Chống duplicate qua 5 service (DRY) |
| **Observability** | Structured logging (pino) + correlation/trace ID xuyên saga, `/health` (terminus), `/metrics` (prom-client). Không bắt buộc Grafana — chỉ cần endpoint để học |
| **Analytics (tùy chọn)** | **Advanced track (Phase 12)**: CDC `Postgres → Debezium → Kafka → ClickHouse` → read model bất đồng bộ. Nặng máy → tách `docker-compose.cdc.yml`, không thuộc core |
| **Patterns** | Outbox, Event-driven, CQRS, Repository, Aggregate Root, Saga, RBAC, Idempotent Consumer, Shared Contracts, (tùy chọn) CDC |
| **Chi phí** | **$0/tháng** (Supabase free + Upstash free + Pub/Sub Emulator local; CDC track cũng $0 — toàn OSS chạy local) |

---

## Cấu trúc thư mục

```
erp-prototype-example/
│
├── backend/
│   ├── package.json                # script orchestrator (build:shared, dev) — KHÔNG workspaces
│   ├── docker-compose.yml          # Chỉ Pub/Sub Emulator (core)
│   ├── docker-compose.cdc.yml      # (tùy chọn) Kafka + Debezium + ClickHouse — Phase 12
│   ├── .env                        # Supabase DB URL, Upstash Redis URL, Pub/Sub config
│   │
│   ├── shared/                     # @erp/shared — code dùng chung mọi service (Phase 2.5)
│   │   ├── package.json
│   │   └── src/
│   │       ├── contracts/          # Event types + payload interfaces (typed, DRY)
│   │       ├── messaging/          # OutboxWorker dùng chung + idempotency helper + Pub/Sub wrapper
│   │       ├── persistence/        # PrismaService base
│   │       ├── cache/              # RedisCacheService
│   │       ├── observability/      # pino logger, correlation-id, /metrics, /health
│   │       └── config/             # env validation (zod)
│   │
│   ├── api-gateway/                # NestJS — entry point cho frontend (không có DB)
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── auth-service/               # NestJS — Auth (users, roles, JWT) — schema: auth
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │
│   ├── customer-service/           # NestJS — Customer bounded context — schema: customer
│   │   ├── package.json
│   │   ├── prisma/schema.prisma    # Code-first: prisma migrate dev → tạo tables
│   │   └── src/
│   │
│   ├── order-service/              # NestJS — Order bounded context — schema: order
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │
│   └── inventory-service/          # NestJS — Inventory bounded context — schema: inventory
│       ├── package.json
│       ├── prisma/schema.prisma
│       └── src/
│
├── frontend/                       # Next.js — chỉ gọi api-gateway
│   ├── package.json
│   └── src/
│
├── docs/                           # Tài liệu dự án (viết trước khi code)
│   ├── README.md                   # Sitemap — mục lục + hướng dẫn đọc
│   ├── overview/
│   │   ├── project-goals.md        # Mục tiêu, scope, success criteria
│   │   ├── business-requirements.md # User stories, business context
│   │   ├── tech-decisions.md       # ADR — tại sao chọn từng tech
│   │   └── glossary.md             # Thuật ngữ (DDD, CQRS, Saga, Outbox...)
│   ├── architecture/
│   │   ├── system-overview.md      # Sơ đồ tổng thể, tech stack, luồng request/event
│   │   ├── bounded-contexts.md     # 3 contexts: Customer, Order, Inventory
│   │   ├── data-model.md           # ER diagrams per schema, table definitions
│   │   ├── event-flows.md          # Pub/Sub topics, saga flow, compensation
│   │   ├── rbac.md                 # 3 roles, permission matrix
│   │   └── design-patterns.md      # 11 patterns áp dụng, giải thích từng cái
│   ├── api/
│   │   ├── auth-endpoints.md       # Auth: login, register, refresh, me
│   │   ├── customer-endpoints.md   # Customer CRUD + credit check
│   │   ├── order-endpoints.md      # Order lifecycle + saga triggers
│   │   └── inventory-endpoints.md  # Items, stock levels, movements
│   └── development/
│       ├── getting-started.md      # Setup guide (Supabase, Upstash, Docker, npm)
│       ├── coding-standards.md     # DDD layers, naming, commit format
│       └── study-guide/            # Viết SAU khi code xong từng service
│           ├── README.md           # Reading order + learning roadmap
│           ├── 1-overview.md       # Big picture, tech stack
│           ├── 2-auth-service.md   # Auth deep dive
│           ├── 3-customer-service.md # Customer DDD walkthrough
│           ├── 4-inventory-service.md # Stock, locking, events
│           ├── 5-order-service.md  # Saga, CQRS, aggregate root
│           ├── 6-api-gateway.md    # JWT guard, routing
│           └── 7-frontend.md       # Next.js, Ant Design, React Query
│
└── README.md
```

**Luồng request:**

```
Browser → Frontend (Next.js :3000)
            → API Gateway (:3010)
                → [JWT verify qua auth-service :3004]
                → Customer Service (:3001)
                → Order Service (:3002)
                → Inventory Service (:3003)
```

**Luồng event:**

```
Service A → ghi outbox table (cùng DB transaction)
         → outbox worker poll → publish Pub/Sub topic
         → Service B subscriber nhận event → xử lý
```

---

# CÁC GIAI ĐOẠN PHÁT TRIỂN

---

## Phase 0: Chuẩn bị môi trường

> **Mục tiêu**: Đảm bảo máy dev có đủ tool.

### 0.1 — Cài đặt công cụ

| Tool | Version | Mục đích |
|---|---|---|
| Node.js | >= 20 LTS | Runtime cho NestJS + Next.js |
| npm | >= 10 | Package manager (bundled với Node.js) |
| Docker Desktop | latest | Chạy Pub/Sub Emulator |
| Git | latest | Version control |
| VS Code | latest | IDE — extensions: ESLint, Prisma, Tailwind CSS IntelliSense |

### 0.2 — Tạo tài khoản cloud (free)

**Supabase** (PostgreSQL):
1. Vào https://supabase.com → Sign up → Create project
2. Chọn region gần nhất (Singapore)
3. Copy **Connection string** từ Settings → Database → URI
4. Free tier: 500MB storage, 2 projects

**Upstash** (Redis):
1. Vào https://upstash.com → Sign up → Create Redis database
2. Chọn region gần nhất
3. Copy **UPSTASH_REDIS_REST_URL** và **UPSTASH_REDIS_REST_TOKEN**
4. Free tier: 10,000 commands/day

### 0.3 — Kiểm tra Docker

```bash
docker --version
docker run hello-world    # Verify Docker Desktop đang chạy
```

Docker chỉ dùng cho Pub/Sub Emulator. PostgreSQL và Redis đã chạy trên cloud (Supabase + Upstash).

### 0.4 — Đọc trước concepts (30 phút)

- **DDD**: Chia hệ thống thành bounded contexts, mỗi context có domain model riêng
- **Repository Pattern**: Interface trừu tượng cho data access, domain không biết DB
- **Aggregate Root**: Entity chính quản lý consistency boundary (vd: OrderHeader quản lý OrderLines)
- **Event-Driven**: Services giao tiếp qua events thay vì gọi trực tiếp
- **Outbox Pattern**: Ghi event vào DB cùng transaction với business data → worker publish lên queue
- **CQRS**: Tách model đọc (read) và ghi (write)
- **Saga**: Quản lý distributed transaction qua chuỗi events + compensation khi thất bại
- **API Gateway**: 1 điểm vào duy nhất cho frontend, route request đến đúng service

---

## Phase 1: Khởi tạo repo & cấu trúc folder

> **Mục tiêu**: Tạo skeleton repo.

### 1.1 — Tạo thư mục gốc

```bash
mkdir erp-prototype-example
cd erp-prototype-example
git init
```

Tạo `.gitignore` cho Node.js.

### 1.2 — Tạo cấu trúc 3 folder chính

```bash
mkdir -p backend/api-gateway
mkdir -p backend/auth-service
mkdir -p backend/customer-service
mkdir -p backend/order-service
mkdir -p backend/inventory-service
mkdir -p frontend
mkdir -p docs/overview
mkdir -p docs/architecture
mkdir -p docs/api
mkdir -p docs/development/study-guide
```

**Giải thích**: 3 folders ngang cấp: `backend/` (5 NestJS projects), `frontend/` (Next.js), `docs/` (tài liệu dự án).

### 1.3 — Tạo file backend/.env

`backend/.env` là **template chung**. Mỗi service `cp ../.env .env` rồi đổi `?schema=<svc>` cho đúng schema của mình (xem bảng bên dưới).

```env
# ============================================================
# Supabase PostgreSQL  (copy từ Dashboard → Settings → Database)
# ============================================================
# DATABASE_URL = pooled (port 6543, transaction mode) → app runtime
#   ⚠️ BẮT BUỘC có ?pgbouncer=true (tắt prepared statements cho pooler)
# DIRECT_URL   = direct/session (port 5432) → CHỈ dùng cho `prisma migrate`
#   ⚠️ migrate KHÔNG chạy được qua pooler 6543 → thiếu DIRECT_URL sẽ fail
# ?schema=<svc> = đặt _prisma_migrations vào schema của service (xem Phase 2)
DATABASE_URL="postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=<svc>"
DIRECT_URL="postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=<svc>"

# Upstash Redis (cache + idempotency store cho Pub/Sub consumers)
REDIS_URL="rediss://default:[token]@xxx.upstash.io:6379"
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# GCP Pub/Sub Emulator (chạy local qua Docker)
PUBSUB_EMULATOR_HOST=localhost:8085
PUBSUB_PROJECT_ID=erp-prototype

# JWT — auth-service KÝ, api-gateway VERIFY bằng cùng JWT_SECRET
JWT_SECRET=dev-super-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Service ports
API_GATEWAY_PORT=3010
AUTH_SERVICE_PORT=3004
CUSTOMER_SERVICE_PORT=3001
ORDER_SERVICE_PORT=3002
INVENTORY_SERVICE_PORT=3003

# Service URLs (gateway dùng để route)
AUTH_SERVICE_URL=http://localhost:3004
CUSTOMER_SERVICE_URL=http://localhost:3001
ORDER_SERVICE_URL=http://localhost:3002
INVENTORY_SERVICE_URL=http://localhost:3003
```

**Giá trị `<svc>` cho từng service:**

| Service | `?schema=<svc>` |
|---|---|
| auth-service | `auth` |
| customer-service | `customer` |
| order-service | `order` |
| inventory-service | `inventory` |
| api-gateway | (không có DB — bỏ DATABASE_URL/DIRECT_URL) |

### 1.4 — Commit

```bash
git add .
git commit -m "chore: init project structure — backend (5 services) + frontend + docs"
```

---

## Phase 1.5: Viết Docs Blueprint (trước khi code)

> **Mục tiêu**: Viết overview + architecture + api docs. Dùng làm blueprint để code theo.
> **Study guide viết SAU khi code xong từng service.**

### 1.5.1 — docs/README.md

Sitemap — mục lục link đến tất cả files, hướng dẫn đọc theo thứ tự.

### 1.5.2 — docs/overview/

- `project-goals.md` — mục tiêu prototype, scope (in/out), success criteria
- `business-requirements.md` — user stories cho 3 contexts
- `tech-decisions.md` — ADR: tại sao NestJS, Prisma, Pub/Sub, Supabase, Upstash...
- `glossary.md` — thuật ngữ: DDD, CQRS, Saga, Outbox, Aggregate Root...

### 1.5.3 — docs/architecture/

- `system-overview.md` — sơ đồ tổng thể (Mermaid), tech stack, luồng request + event
- `bounded-contexts.md` — 3 contexts: responsibilities, data ownership, interaction rules
- `data-model.md` — ER diagrams per schema (Mermaid), table definitions, constraints
- `event-flows.md` — topics/subscriptions, saga flow diagram, compensation logic
- `rbac.md` — 3 roles, permission matrix per endpoint
- `design-patterns.md` — 11 patterns áp dụng, giải thích từng cái và nơi validate

### 1.5.4 — docs/api/

- `auth-endpoints.md` — endpoints, request/response examples, error codes
- `customer-endpoints.md` — CRUD + credit check, pagination
- `order-endpoints.md` — lifecycle, saga triggers, CQRS query
- `inventory-endpoints.md` — items, stock levels, movements

### 1.5.5 — docs/development/

- `getting-started.md` — setup: Supabase, Upstash, Docker, npm, first run
- `coding-standards.md` — DDD layer rules, naming conventions, commit format

### 1.5.6 — Commit

```bash
git commit -m "docs: overview, architecture, api reference, development guide"
```

## Phase 2: Kết nối Infrastructure (Supabase + Upstash + Pub/Sub Emulator)

> **Mục tiêu**: Verify kết nối được đến Supabase PostgreSQL, Upstash Redis, và Pub/Sub Emulator.
> **Concept**: Cloud database, code-first migration, message queue emulator.

### 2.1 — Tạo schemas trên Supabase

Mở **Supabase Dashboard** → SQL Editor → chạy:

```sql
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS "order";
CREATE SCHEMA IF NOT EXISTS inventory;
```

Prisma code-first sẽ tạo tables bên trong các schemas này. Nhưng schemas phải tạo trước vì Prisma không tự tạo schema.

**Cô lập migration history trên shared database (QUAN TRỌNG):**

5 service dùng **chung 1 database**. Mặc định Prisma ghi lịch sử migration vào **một** bảng `_prisma_migrations` ở schema `public`. Nếu cả 5 service cùng ghi vào đó → khi service B migrate, nó thấy migration của service A là "lạ" → báo **drift** / đòi reset DB.

Cách xử lý phù hợp cho project học (không cần tách DB riêng): **cho mỗi service một bảng `_prisma_migrations` riêng nằm trong schema của chính nó.** Hai điều kiện đảm bảo việc này:

1. Mỗi service datasource chỉ khai báo **đúng 1 schema** của mình: `schemas = ["customer"]`, `["order"]`, `["inventory"]`, `["auth"]`.
2. Connection string của service thêm `?schema=<svc>` (đã set trong `.env` ở Phase 1.3).

Kết quả: mỗi service có lịch sử migration độc lập, không service nào nhìn thấy migration của service khác → **không còn drift**:

```
auth._prisma_migrations        ← auth-service quản lý
customer._prisma_migrations    ← customer-service quản lý
order._prisma_migrations       ← order-service quản lý
inventory._prisma_migrations   ← inventory-service quản lý
```

> Verify sau lần migrate đầu: `SELECT table_schema FROM information_schema.tables WHERE table_name = '_prisma_migrations';` → phải thấy 4 dòng (auth, customer, order, inventory), KHÔNG có `public`.

### 2.2 — Viết backend/docker-compose.yml (chỉ Pub/Sub Emulator)

```yaml
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/google-cloud-cli:latest
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085 --project=erp-prototype
    ports:
      - "8085:8085"
```

```bash
cd backend
docker compose up -d    # Pub/Sub Emulator chạy trên localhost:8085
```

**Tại sao Pub/Sub Emulator?**: Code dùng `@google-cloud/pubsub` SDK — set env `PUBSUB_EMULATOR_HOST=localhost:8085` → SDK tự connect emulator. Bỏ env var khi deploy GCP → zero code change.

### 2.3 — Verify kết nối

```bash
# Test Supabase PostgreSQL
npx prisma db pull    # Kết nối OK nếu không lỗi

# Test Pub/Sub Emulator
curl http://localhost:8085    # Responds nếu đang chạy
```

### 2.4 — Hiểu code-first workflow

```
Prisma schema (code) → prisma migrate dev → Supabase PostgreSQL tables
```

Không viết SQL tay. Prisma đọc `schema.prisma` → generate migration SQL → apply lên Supabase DB.

**`migrate dev` vs `migrate deploy` — đừng nhầm:**

| Lệnh | Dùng khi | Lưu ý |
|---|---|---|
| `prisma migrate dev --name xxx` | **Lúc dev**, khi đổi schema → tạo file migration mới | Dev-only. Có thể **reset cả DB** nếu phát hiện drift → KHÔNG chạy ở môi trường có data thật |
| `prisma migrate deploy` | **Khi start service** / chạy lại → apply các migration đã có | An toàn, không reset, không prompt |

Quy trình: dev đổi schema → `migrate dev` (tạo migration) **một lần**; các lần start/chạy lại sau đó → `migrate deploy`.

### 2.6 — Commit

```bash
git commit -m "infra: Supabase PostgreSQL, Upstash Redis, Pub/Sub emulator config"
```

---

## Phase 2.5: Shared Library (`@erp/shared`) & Observability Foundation

> **Mục tiêu**: Tạo package dùng chung **TRƯỚC** khi build các service → không copy-paste outbox worker, event names, idempotency, observability qua 5 service.
> **Tại sao đặt ở đây**: customer-service (Phase 3) trở đi sẽ `import` từ `@erp/shared`. Làm nền trước, các service sau chỉ ráp lại.
> **Patterns**: DRY, Shared Kernel (DDD), Idempotent Consumer, Observability.

> [!NOTE]
> customer-service có thể đã build bản nháp (outbox worker, RedisCacheService...) trước khi có shared → khi tới Phase 3, **refactor** nó để dùng `@erp/shared` (rút phần dùng chung ra). Đây là minh hoạ sống cho DRY: code lặp ở service thứ 2 là tín hiệu phải kéo lên shared.

### 2.5.1 — Chia sẻ code qua `file:` dependency (KHÔNG dùng npm workspaces)

> [!WARNING]
> **Vì sao KHÔNG npm workspaces?** Mỗi service có **Prisma Client riêng** (schema khác nhau). Workspace sẽ hoist `@prisma/client` + generated client (`.prisma/client`) lên `backend/node_modules` → 5 service ghi đè generated client của nhau → **vỡ**. Nên giữ `node_modules` per-service ĐỘC LẬP, chia sẻ code qua `file:` dependency. (Repo tham khảo `wecare-erp-dev` dùng workspaces được vì nó chỉ có 1 Prisma/TypeORM chung.)

`@erp/shared` là 1 package standalone, build ra `dist/`, các service trỏ tới qua `file:../shared`.

`backend/package.json` chỉ là **script orchestrator** (không khai báo `workspaces`):

```json
{
  "name": "erp-backend",
  "private": true,
  "scripts": {
    "install:shared": "npm install --prefix shared",
    "build:shared": "npm run build --prefix shared"
  }
}
```

### 2.5.2 — Tạo package `@erp/shared` (build ra `dist/`)

```bash
mkdir -p backend/shared/src/{contracts,messaging,persistence,cache,observability,config}
```

`backend/shared/package.json` — trỏ `main`/`types` vào `dist/` (phải build trước khi service dùng):

```json
{
  "name": "@erp/shared",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```

Mỗi service thêm `"@erp/shared": "file:../shared"` vào `dependencies` → `import { ... } from '@erp/shared'`.

**Quy trình build** (shared TRƯỚC, service SAU):

```bash
cd backend/shared && npm install && npm run build   # tạo dist/ (.js + .d.ts)
cd ../customer-service && npm install               # link file:../shared
```

> **Lưu ý cho test**: `@erp/shared` build CommonJS → khớp service (CJS). Nhưng `uuid` v14 là ESM-only: app chạy được (Node 24 hỗ trợ `require(ESM)`) còn jest thì không → map `uuid` sang mock trong `jest.moduleNameMapper`, và map `^@erp/shared$` về `shared/src` để test khỏi cần build dist trước.

### 2.5.3 — Event Contracts (typed — hết magic string)

`shared/src/contracts/events.ts`:

```typescript
// Tên topic/event — KHÔNG hardcode 'customer.created' rải rác mỗi service nữa
export const EVENT = {
  CUSTOMER_CREATED: 'customer.created',
  ORDER_SUBMITTED: 'order.submitted',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RESERVATION_FAILED: 'inventory.reservation-failed',
  INVENTORY_RELEASED: 'inventory.released',
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];

// Hợp đồng payload — producer và consumer cùng 1 type → gõ sai là compile error
export interface OrderSubmittedPayload {
  orderId: string;
  customerId: string;
  totalAmount: number;
  lines: { itemId: string; quantity: number }[];
}
export interface InventoryReservedPayload { orderId: string; reservationId: string; }
// ... các payload còn lại
```

**Concept — Shared Kernel**: contracts là phần model mà 2 bounded context ĐỒNG Ý dùng chung. Đổi 1 chỗ → cả producer lẫn consumer cùng cập nhật type, không lệch tên topic giữa Order ↔ Inventory.

### 2.5.4 — Outbox Worker dùng chung

Rút `OutboxWorkerService` (đang nằm trong customer-service) ra `shared/src/messaging/outbox-worker.service.ts`, generic hoá:

- Nhận vào: `PrismaClient` (hoặc callback query/markPublished) + Pub/Sub client.
- **Cache danh sách topic đã tạo lúc startup** → không gọi `topic.exists()` mỗi event (sửa luôn điểm chưa tối ưu: hiện worker round-trip Pub/Sub mỗi lần publish).
- Thêm cột `retryCount` + ngưỡng → quá ngưỡng đẩy record sang trạng thái `dead` thay vì kẹt đầu hàng FIFO.

5 service chỉ cần `new OutboxWorkerService(prisma, topicMap)` — không copy-paste.

### 2.5.5 — Idempotency helper (Idempotent Consumer)

`shared/src/messaging/idempotency.ts`:

```typescript
// Bọc handler: chỉ chạy 1 lần cho mỗi eventId (dedup at-least-once của Pub/Sub)
export async function withIdempotency(
  redis: Redis,
  eventId: string,
  handler: () => Promise<void>,
): Promise<void> {
  const fresh = await redis.set(`processed:${eventId}`, '1', 'EX', 86400, 'NX');
  if (!fresh) return;                                       // đã xử lý → bỏ qua
  try {
    await handler();
  } catch (err) {
    await redis.del(`processed:${eventId}`);                // fail → cho phép retry
    throw err;
  }
}
```

Inventory (Phase 4.5) và Order (Phase 5.6) gọi chung hàm này thay vì viết lại logic `SET NX` mỗi nơi.

### 2.5.6 — Observability primitives

> **Tại sao quan trọng**: saga chạy xuyên 4 service. Không có correlation ID → debug 1 order fail = mò log 4 nơi rời rạc. Đây là thứ đáng đầu tư nhất sau shared contracts.

**a) Structured logging + correlation ID** — `shared/src/observability/`:

- `logger.ts` — pino factory (JSON log, level theo env).
- `correlation.ts` — middleware đọc/sinh `x-correlation-id`, lưu vào `AsyncLocalStorage`, gắn vào MỌI log line.
- **Truyền correlation ID qua event**: outbox ghi kèm `correlationId` vào metadata của payload → subscriber đọc ra, set lại vào context → 1 order xuyên 4 service share cùng 1 ID. Filter log theo ID = thấy cả vòng đời saga.

**b) Health check** — `shared/src/observability/health.ts` (dùng `@nestjs/terminus`):

- `GET /health` kiểm tra DB (Prisma `SELECT 1`) + Redis ping + Pub/Sub reachable.
- Mỗi service expose `/health` → readiness/liveness probe.

**c) Metrics** — `shared/src/observability/metrics.ts` (dùng `prom-client`):

- `GET /metrics` (Prometheus format). Counter học được nhiều: `events_published_total`, `events_consumed_total`, `outbox_lag` (số record chưa publish), `reservation_failed_total`, `saga_duration_seconds`.
- Không cần Grafana cho prototype — `curl /metrics` là đủ để học. Muốn dashboard → thêm Prometheus + Grafana (tùy chọn, đặt cùng `docker-compose.cdc.yml` hoặc file riêng).

### 2.5.7 — PrismaService base + RedisCacheService

Rút `PrismaService` và `RedisCacheService` (customer-service đang có) ra `shared/src/persistence/` và `shared/src/cache/` → 5 service kế thừa, không lặp.

### 2.5.8 — Commit

```bash
git commit -m "feat(shared): @erp/shared — contracts, outbox worker, idempotency, observability"
```

---

## Phase 3: Customer Service — Bounded Context đầu tiên

> **Mục tiêu**: Implement Customer context hoàn chỉnh. Service ĐƠN GIẢN NHẤT, dùng để học patterns.
> **Patterns**: DDD layers, Repository, Value Objects, Outbox, Pub/Sub publish.

> [!NOTE]
> **Dùng `@erp/shared` (Phase 2.5)**: outbox worker, event names (`EVENT.CUSTOMER_CREATED`), idempotency, `PrismaService`/`RedisCacheService`, logger + `/health` + `/metrics` đều `import` từ `@erp/shared` — KHÔNG viết lại. Nếu customer-service đã có bản nháp các thứ này, **refactor** để dùng shared. Khi viết controller (3.11), thêm luôn `GET /health` + `GET /metrics` từ shared.

### 3.1 — Scaffold NestJS project

```bash
cd backend/customer-service
npx @nestjs/cli new . --skip-git --package-manager npm
npm install @prisma/client @google-cloud/pubsub ioredis zod uuid
npm install -D prisma @types/uuid
```

### 3.2 — Tạo cấu trúc thư mục DDD

```bash
mkdir -p src/domain/entities
mkdir -p src/domain/value-objects
mkdir -p src/domain/repositories
mkdir -p src/application/commands
mkdir -p src/application/queries
mkdir -p src/infrastructure/persistence
mkdir -p src/infrastructure/messaging
mkdir -p src/presentation
```

**Concept — DDD Layers:**

```
┌─ presentation/     ← REST controllers (nhận HTTP request)
├─ application/      ← Use cases (commands = ghi, queries = đọc)
├─ domain/           ← Business logic thuần (KHÔNG biết DB, HTTP, Pub/Sub)
└─ infrastructure/   ← Implementations cụ thể (Prisma, Pub/Sub client)
```

**Quy tắc**: Domain KHÔNG import từ infrastructure. Dependency chỉ chảy ngoài → trong.

### 3.3 — Viết Prisma schema (code-first)

Tạo `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (6543) — runtime
  directUrl = env("DIRECT_URL")     // direct (5432) — migrate
  schemas   = ["customer"]          // chỉ 1 schema → _prisma_migrations nằm trong customer
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

model CustomerCore {
  id                  String    @id @default(uuid())
  businessName        String    @map("business_name")
  taxCode             String?   @map("tax_code")
  status              String    @default("active")
  creditLimitAmount   Decimal?  @map("credit_limit_amount") @db.Decimal(15, 2)
  creditLimitCurrency String    @default("VND") @map("credit_limit_currency")
  paymentTerms        String?   @map("payment_terms")
  contactName         String?   @map("contact_name")
  contactPhone        String?   @map("contact_phone")
  contactEmail        String?   @map("contact_email")
  address             String?
  province            String?
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")

  @@map("cores")
  @@schema("customer")
}

model Outbox {
  id          String    @id @default(uuid())
  eventType   String    @map("event_type")
  payload     Json
  createdAt   DateTime  @default(now()) @map("created_at")
  publishedAt DateTime? @map("published_at")

  @@index([createdAt], map: "idx_outbox_unpublished")
  @@map("outbox")
  @@schema("customer")
}
```

Chạy migration — Prisma tự tạo schema `customer` + tables:

```bash
npx prisma migrate dev --name init-customer
# → CREATE SCHEMA customer; CREATE TABLE customer.cores (...); CREATE TABLE customer.outbox (...);
```

**Đây là code-first**: Viết Prisma model → Prisma generate SQL → apply lên PostgreSQL. Không viết SQL tay.

### 3.4 — Định nghĩa Customer entity (Domain layer)

Tạo `src/domain/entities/customer.entity.ts`:

```typescript
export type CustomerStatus = 'prospect' | 'active' | 'suspended' | 'archived';

export class Customer {
  constructor(
    public readonly id: string,
    public businessName: string,
    public taxCode: string | null,
    public status: CustomerStatus,
    public creditLimitAmount: number | null,
    public creditLimitCurrency: string,
    public paymentTerms: string | null,
    public contactName: string | null,
    public contactPhone: string | null,
    public contactEmail: string | null,
    public address: string | null,
    public province: string | null,
    public createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  canPlaceOrder(orderAmount: number): boolean {
    if (this.status !== 'active') return false;
    if (this.creditLimitAmount === null) return false;
    return orderAmount <= this.creditLimitAmount;
  }

  archive(): void {
    this.status = 'archived';
    this.deletedAt = new Date();
  }
}
```

**Concept — Rich Domain Model**: Entity chứa business logic (`canPlaceOrder`), không chỉ data holder.

> **Tiền tệ**: DB dùng `Decimal(15,2)` (đúng). Ở đây map sang `number` cho gọn — prototype chấp nhận được, nhưng JS `number` mất chính xác với số lớn. Nếu làm thật, giữ tiền dưới dạng `Decimal`/`string` (hoặc số nguyên đơn vị nhỏ nhất) xuyên suốt domain.

### 3.5 — Tạo Value Objects

Tạo `src/domain/value-objects/tax-code.vo.ts`:

```typescript
export class TaxCode {
  constructor(public readonly value: string) {
    if (value && !TaxCode.isValid(value)) {
      throw new Error('Invalid Vietnamese tax code format');
    }
  }
  static isValid(code: string): boolean {
    return /^\d{10}(-\d{3})?$/.test(code);
  }
}
```

**Concept — Value Object vs Entity**: Entity có identity (id). Value Object không — hai TaxCode("1234567890") là BẰNG NHAU.

### 3.6 — Định nghĩa Repository Interface (Domain layer)

Tạo `src/domain/repositories/customer.repository.ts`:

```typescript
export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByTaxCode(taxCode: string): Promise<Customer | null>;
  search(query: string, page: number, limit: number): Promise<{ data: Customer[]; total: number }>;
  save(customer: Customer): Promise<Customer>;
  delete(id: string): Promise<void>;
}
```

**Pattern — Repository**: Domain chỉ biết interface. Prisma implementation ở infrastructure layer. Đổi DB → viết implementation mới, domain KHÔNG đổi.

### 3.7 — Implement Repository bằng Prisma (Infrastructure layer)

Tạo `src/infrastructure/persistence/customer.repository.impl.ts`:

```typescript
export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customerCore.findFirst({
      where: { id, deletedAt: null }
    });
    return record ? this.toDomain(record) : null;
  }

  async save(customer: Customer): Promise<Customer> {
    const data = this.toPrisma(customer);
    const record = await this.prisma.customerCore.upsert({
      where: { id: customer.id },
      create: data,
      update: data,
    });
    return this.toDomain(record);
  }

  private toDomain(record: any): Customer { /* mapping */ }
  private toPrisma(entity: Customer): any { /* mapping */ }
}
```

**Concept — Data Mapper**: Repository mapping giữa DB record ↔ domain entity.

### 3.8 — Viết Application layer (Commands + Queries)

**Commands** (ghi):
- `create-customer.command.ts` → validate (Zod) → tạo entity → save → ghi outbox
- `update-customer.command.ts` → load → apply changes → save → ghi outbox
- `delete-customer.command.ts` → soft delete

**Queries** (đọc):
- `get-customer.query.ts` → 1 customer theo id
- `search-customers.query.ts` → search + pagination
- `check-credit.query.ts` → credit check (Order service sẽ gọi)

### 3.9 — Tích hợp Outbox pattern

Trong `create-customer.command.ts`:

```typescript
async execute(dto: CreateCustomerDto): Promise<Customer> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Tạo customer
    const record = await tx.customerCore.create({ data: { ... } });

    // 2. Ghi event vào outbox (CÙNG transaction)
    await tx.outbox.create({
      data: {
        eventType: 'customer.created',
        payload: { id: record.id, businessName: record.businessName }
      }
    });

    return this.toDomain(record);
  });
}
```

**Pattern — Transactional Outbox**: Event + business data LUÔN consistent vì cùng transaction.

### 3.10 — Viết Outbox Worker + Pub/Sub Publisher

Tạo `src/infrastructure/messaging/outbox-worker.ts`:

```typescript
import { PubSub } from '@google-cloud/pubsub';

// SDK đọc env PUBSUB_EMULATOR_HOST → tự connect emulator
const pubsub = new PubSub({ projectId: 'erp-prototype' });

// Worker chạy mỗi 2 giây:
// 1. SELECT FROM customer.outbox WHERE published_at IS NULL
// 2. Publish lên Pub/Sub topic tương ứng
// 3. UPDATE published_at = NOW()
// 4. Pub/Sub down → record vẫn trong DB, retry lần sau

async function publishEvent(eventType: string, payload: any) {
  const topic = pubsub.topic(eventType);  // vd: 'customer.created'
  await topic.publishMessage({ json: payload });
}
```

**Pub/Sub setup**: Topics + subscriptions được tạo programmatically trong code service khi startup (dùng `topic.get({ autoCreate: true })`), không cần script riêng.

### 3.11 — Viết REST Controller

Tạo `src/presentation/customer.controller.ts`:

```typescript
@Controller('customers')
export class CustomerController {
  @Post()                    // POST /customers
  @Get(':id')                // GET /customers/:id
  @Patch(':id')              // PATCH /customers/:id
  @Delete(':id')             // DELETE /customers/:id
  @Get()                     // GET /customers?q=...&page=1
  @Get(':id/credit-check')   // GET /customers/:id/credit-check
}
```

### 3.12 — Unit tests

- Domain: `customer.canPlaceOrder()`, `TaxCode.isValid()`
- Application: CreateCustomerCommand (mock repository)

### 3.13 — Test thủ công

```bash
cd backend/customer-service
cp ../.env .env                       # Copy env, đổi ?schema=<svc> → ?schema=customer
npx prisma migrate dev --name init-customer   # Lần đầu: tạo migration + tables
# (các lần sau chỉ cần: npx prisma migrate deploy)
npm run dev                           # Start :3001

# Postman
POST http://localhost:3001/customers     { "businessName": "WeCare Corp" }
GET  http://localhost:3001/customers/:id
```

### 3.14 — Commit

```bash
git commit -m "feat(customer): DDD, repository, outbox, Pub/Sub publish, REST API"
```

---

## Phase 4: Inventory Service — Concurrency & Constraints

> **Mục tiêu**: Zero-negative constraint, optimistic locking, Pub/Sub subscriber.
> **Patterns**: Optimistic concurrency, CHECK constraint, event-driven.

> [!NOTE]
> **Dùng `@erp/shared`**: subscriber bọc handler bằng `withIdempotency(redis, eventId, ...)` (2.5.5) thay vì tự viết `SET NX`. Đọc `correlationId` từ event metadata → set vào context để log nối tiếp saga. Topic name lấy từ `EVENT.*`. Thêm `/health` + `/metrics` từ shared.

### 4.1 — Scaffold NestJS project

```bash
cd backend/inventory-service
npx @nestjs/cli new . --skip-git --package-manager npm
npm install @prisma/client @google-cloud/pubsub ioredis zod uuid
npm install -D prisma @types/uuid
```

### 4.2 — Prisma schema (code-first)

Datasource giống Customer: `url = DATABASE_URL`, `directUrl = DIRECT_URL`, `schemas = ["inventory"]` (đảm bảo `_prisma_migrations` nằm trong schema `inventory`).

Tables trong schema `inventory`:
- `items` — SKU master
- `warehouses` — danh sách kho
- `stock_levels` — tồn kho per (item, warehouse), cột **version** cho optimistic locking
- `movements` — append-only log
- `reservations` — hold stock cho order
- `outbox`

Thêm CHECK constraint (qua raw SQL trong migration):
```sql
ALTER TABLE inventory.stock_levels
  ADD CONSTRAINT chk_on_hand CHECK (on_hand_quantity >= 0);
ALTER TABLE inventory.stock_levels
  ADD CONSTRAINT chk_reserved CHECK (reserved_quantity >= 0);
```

### 4.3 — Domain entity: StockLevel

```typescript
export class StockLevel {
  reserve(quantity: number): void {
    const available = this.onHandQuantity - this.reservedQuantity;
    if (quantity > available) {
      throw new InsufficientStockError(this.itemId, quantity, available);
    }
    this.reservedQuantity += quantity;
    this.version += 1;
  }

  release(quantity: number): void {
    this.reservedQuantity -= quantity;
    this.version += 1;
  }
}
```

### 4.4 — Optimistic Locking trong Repository

```typescript
async updateStockLevel(stockLevel: StockLevel): Promise<void> {
  const result = await this.prisma.stockLevel.updateMany({
    where: {
      itemId: stockLevel.itemId,
      version: stockLevel.version - 1,  // CHỈ update nếu version chưa đổi
    },
    data: {
      reservedQuantity: stockLevel.reservedQuantity,
      version: stockLevel.version,
    },
  });
  if (result.count === 0) {
    throw new OptimisticLockError('Stock changed, retry');
  }
}
```

**Concept — Optimistic Locking**: 2 requests reserve cùng lúc → 1 thắng, 1 retry.

### 4.5 — Pub/Sub Subscriber: lắng nghe events

Tạo `src/infrastructure/messaging/event-subscriber.ts`:

```typescript
const pubsub = new PubSub({ projectId: 'erp-prototype' });

// Lắng nghe order.submitted
const subscription = pubsub.subscription('inventory-on-order-submitted');
subscription.on('message', async (message) => {
  const event = JSON.parse(message.data.toString());
  const eventId = event.eventId ?? message.id;   // id duy nhất của event

  // --- IDEMPOTENCY: dedup at-least-once delivery ---
  // SET key NX → trả 'OK' nếu lần đầu, null nếu đã xử lý rồi
  const fresh = await redis.set(`processed:${eventId}`, '1', 'EX', 86400, 'NX');
  if (!fresh) { message.ack(); return; }         // đã xử lý → bỏ qua, không reserve lần 2

  try {
    await this.reserveStock(event);
    message.ack();
  } catch (err) {
    await redis.del(`processed:${eventId}`);      // xử lý fail → cho phép retry
    message.nack();                               // Pub/Sub redeliver
  }
});
```

**Pattern — Idempotent Consumer (BẮT BUỘC với Pub/Sub):** Pub/Sub là *at-least-once* — cùng 1 message có thể đến >1 lần. Không dedup → **reserve gấp đôi** tồn kho. Dùng Upstash Redis làm dedup store (`SET ... NX`). _Đây cũng chính là chỗ Upstash Redis được dùng thật trong prototype._

> Bản "exactly-once" tuyệt đối: lưu `eventId` vào bảng `processed_events` **cùng transaction** với reserve (DB rollback thì dedup cũng rollback). Redis đơn giản hơn và đủ tốt cho mục đích học — chấp nhận khe hở rất nhỏ nếu service crash giữa reserve và set key.

Reserve stock logic:
- Parse items + quantities từ event
- Reserve từng item (transaction + outbox)
- Tất cả OK → publish `inventory.reserved`
- Bất kỳ fail → release đã reserve, publish `inventory.reservation-failed`

### 4.6 — REST API

```
POST /items              — tạo item
GET  /items/:id          — lấy item
GET  /items              — search
GET  /levels/:itemId     — stock level
POST /movements          — nhập/xuất stock thủ công
```

### 4.7 — Commit

```bash
git commit -m "feat(inventory): stock, optimistic locking, Pub/Sub subscriber"
```

---

## Phase 5: Order Service — Saga + CQRS + Aggregate Root

> **Mục tiêu**: Service PHỨC TẠP NHẤT — kết hợp nhiều patterns.
> **Patterns**: Aggregate Root, Saga choreography, CQRS read model.

> [!NOTE]
> **Dùng `@erp/shared`**: mọi subscriber dùng `withIdempotency`; outbox worker + event contracts từ shared. **Correlation ID xuyên saga**: khi order submit, sinh `correlationId`, ghi vào outbox metadata → propagate qua `inventory.reserved` → `order.confirmed`... → 1 lệnh `grep <correlationId>` thấy toàn bộ lifecycle qua 4 service. Đây là chỗ observability (2.5.6) phát huy rõ nhất.

### 5.1 — Scaffold NestJS project

### 5.2 — Prisma schema

Datasource giống Customer: `url = DATABASE_URL`, `directUrl = DIRECT_URL`, `schemas = ["order"]`.

Tables trong schema `order`:
- `headers` — aggregate root
- `lines` — chỉ access qua header
- `status_history` — append-only event log
- `lifecycle_view` — **CQRS denormalized read model**
- `outbox`

### 5.3 — Aggregate Root: OrderHeader

```typescript
export class OrderHeader {
  private lines: OrderLine[] = [];

  addLine(itemId: string, quantity: number, unitPrice: number): void {
    this.lines.push(new OrderLine(...));
    this.recalculateTotals();
  }

  submit(): void {
    if (this.status !== 'draft') throw new Error('Only draft can submit');
    if (this.lines.length === 0) throw new Error('Cannot submit empty order');
    this.status = 'submitted';
  }

  confirm(): void {
    if (this.status !== 'submitted') throw new Error('Only submitted can confirm');
    this.status = 'confirmed';
  }

  cancel(reason: string): void {
    if (['fulfilled', 'completed'].includes(this.status)) {
      throw new Error('Cannot cancel fulfilled/completed');
    }
    this.status = 'cancelled';
    this.cancelReason = reason;
  }
}
```

**Pattern — Aggregate Root**: OrderHeader là cửa ngõ duy nhất. Không ai trực tiếp tạo OrderLine.

### 5.4 — Saga flow (Choreography)

```
Bước 1: User submit order
  → Order: status = 'submitted' → outbox → Pub/Sub: order.submitted

Bước 2: Inventory nhận order.submitted
  → Reserve stock
  → OK → Pub/Sub: inventory.reserved
  → FAIL → Pub/Sub: inventory.reservation-failed

Bước 3a (OK): Order nhận inventory.reserved
  → HTTP GET customer-service:3001/customers/{id}/credit-check
  → Credit OK → status = 'confirmed' → Pub/Sub: order.confirmed
  → Credit FAIL → status = 'failed_credit' → Pub/Sub: order.cancelled

Bước 3b (FAIL): Order nhận inventory.reservation-failed
  → status = 'failed_no_stock'

Bước 4 (Compensation): Inventory nhận order.cancelled
  → Release reserved stock → Pub/Sub: inventory.released
```

**Lưu ý thiết kế (đọc kỹ):**

- **Trộn choreography + orchestration**: phần lớn là choreography (qua events), nhưng credit-check ở Bước 3a là **gọi HTTP đồng bộ** sang customer-service. Đây là coupling đồng bộ duy nhất — chấp nhận để demo cả 2 kiểu giao tiếp. Nếu muốn thuần event-driven: customer-service publish `customer.credit-reserved` / `customer.credit-rejected` thay vì cho gọi HTTP.
- **Thứ tự reserve trước, credit-check sau là CHỦ Ý**: cách này buộc phải **compensation** (release stock) khi credit fail → đúng mục tiêu học Saga compensation. Trong thực tế thường credit-check trước (rẻ, không cần bù trừ) rồi mới reserve. Ghi rõ trade-off này trong `docs/architecture/event-flows.md`.
- **Idempotency**: mọi subscriber trong saga (Inventory reserve, Order confirm, Inventory release) đều phải idempotent như Phase 4.5 — nếu không, redelivery sẽ confirm/release nhiều lần.

### 5.5 — CQRS Read Model

Table `order.lifecycle_view` — denormalized:

```prisma
model LifecycleView {
  orderId        String   @id @map("order_id")
  orderNumber    String   @map("order_number")
  customerName   String   @map("customer_name")
  status         String
  totalAmount    Decimal  @map("total_amount")
  lineCount      Int      @map("line_count")
  submittedAt    DateTime? @map("submitted_at")
  reservedAt     DateTime? @map("reserved_at")
  confirmedAt    DateTime? @map("confirmed_at")
  fulfilledAt    DateTime? @map("fulfilled_at")

  @@map("lifecycle_view")
  @@schema("order")
}
```

Mỗi status change → UPDATE lifecycle_view. 1 query lấy toàn bộ lifecycle.

**Pattern — CQRS**: Source of truth = `headers` + `status_history`. Read model = `lifecycle_view` (optimized cho query).

### 5.6 — Pub/Sub Subscribers

Order Service lắng nghe:
- `inventory.reserved` → credit check → confirm
- `inventory.reservation-failed` → status = failed_no_stock

> Bọc cả 2 handler bằng idempotency check (`SET processed:<eventId> NX`) y như Phase 4.5 trước khi xử lý.

### 5.7 — REST API

```
POST /orders                  — tạo draft
GET  /orders/:id              — chi tiết + lines
POST /orders/:id/lines        — thêm line
POST /orders/:id/submit       — submit → saga
POST /orders/:id/cancel       — cancel
GET  /orders                  — search
GET  /orders/:id/lifecycle    — CQRS lifecycle view
```

### 5.8 — Commit

```bash
git commit -m "feat(order): saga, CQRS, aggregate root, lifecycle"
```

---

## Phase 6: Auth Service + API Gateway

> **Mục tiêu**: Tự code auth (bcrypt + JWT), 3 roles. Gateway verify JWT trước khi forward.
> **Patterns**: RBAC, JWT authentication, Guard pattern.

> [!NOTE]
> **Gateway là điểm khởi đầu trace**: middleware từ `@erp/shared` (2.5.6) sinh `x-correlation-id` nếu request chưa có, forward xuống mọi service → ID xuyên suốt HTTP + event. Auth-service + gateway cũng expose `/health` + `/metrics`.

### 6.1 — Scaffold Auth Service

```bash
cd backend/auth-service
npx @nestjs/cli new . --skip-git --package-manager npm
npm install @prisma/client bcrypt jsonwebtoken zod uuid
npm install -D prisma @types/bcrypt @types/jsonwebtoken @types/uuid
```

### 6.2 — Prisma schema cho Auth (code-first)

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["auth"]
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  fullName     String   @map("full_name")
  role         String   @default("staff")  // admin | manager | staff
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("users")
  @@schema("auth")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("refresh_tokens")
  @@schema("auth")
}
```

```bash
npx prisma migrate dev --name init-auth
```

**3 Roles:**

| Role | Quyền |
|---|---|
| `admin` | Full — CRUD tất cả, quản lý users, approve orders |
| `manager` | CRUD + approve orders, không quản lý users |
| `staff` | Chỉ xem + tạo (create + read), không sửa/xóa |

### 6.3 — Auth API endpoints

```typescript
@Controller('auth')
export class AuthController {
  @Post('register')     // POST /auth/register — tạo user (admin only)
  @Post('login')        // POST /auth/login — email + password → JWT token
  @Post('refresh')      // POST /auth/refresh — refresh token → new JWT
  @Post('logout')       // POST /auth/logout — invalidate refresh token
  @Get('me')            // GET /auth/me — lấy thông tin user hiện tại
  // @Get('verify')     // TÙY CHỌN — chỉ cần nếu muốn revoke token (introspection).
                        // Mặc định gateway verify JWT LOCAL (xem 6.6), không gọi endpoint này.
}
```

**Login flow:**

```
1. POST /auth/login { email, password }
2. Auth service: bcrypt.compare(password, hash)
3. OK → sign JWT { userId, email, role, exp: 15min }
4. Trả về: { accessToken, refreshToken }
```

**JWT payload:**

```typescript
{
  sub: "user-uuid",
  email: "admin@wecare.vn",
  role: "admin",        // admin | manager | staff
  iat: 1234567890,
  exp: 1234568790       // 15 min
}
```

### 6.4 — Seed admin user

Tạo `prisma/seed.ts` — tạo user admin mặc định:

```typescript
// email: admin@erp.local, password: admin123, role: admin
```

### 6.5 — Scaffold API Gateway

```bash
cd backend/api-gateway
npx @nestjs/cli new . --skip-git --package-manager npm
npm install @nestjs/axios axios jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 6.6 — Gateway: JWT Guard middleware

```typescript
// Gateway nhận mọi request từ frontend
// 1. Đọc header: Authorization: Bearer <token>
// 2. Verify JWT LOCAL bằng JWT_SECRET (jwt.verify) — KHÔNG gọi auth-service mỗi request
//    → nhanh, không thêm network hop. Đánh đổi: không revoke được token trước khi hết hạn
//    (chấp nhận được vì access token chỉ sống 15 phút)
// 3. Gắn user info (userId, role) vào request header (vd: x-user-id, x-user-role) khi forward
// 4. Check role có quyền gọi endpoint không (RBAC)
// 5. OK → forward đến service. Fail → 401/403

// Ngoại lệ (KHÔNG cần JWT): POST /api/auth/login, POST /api/auth/refresh
// (register là admin-only → VẪN cần JWT)
```

> **Nhất quán**: gateway và auth-service dùng **chung** `JWT_SECRET` trong `.env`. Auth ký bằng secret, gateway verify bằng cùng secret đó. Không dùng `/auth/verify` ở luồng mặc định.

### 6.7 — Gateway: Proxy routing (có auth)

```typescript
// Public (không cần JWT):
// POST /api/auth/login   → http://auth-service:3004/auth/login
// POST /api/auth/refresh → http://auth-service:3004/auth/refresh

// Protected (cần JWT):
// /api/auth/*            → http://auth-service:3004/auth/*
// /api/customers/*       → http://customer-service:3001/customers/*
// /api/orders/*          → http://order-service:3002/orders/*
// /api/inventory/*       → http://inventory-service:3003/*
```

### 6.8 — Commit

```bash
git commit -m "feat(auth): auth service + gateway JWT guard + RBAC"
```
```

---

## Phase 7: Integration Testing — E2E

> **Mục tiêu**: Test toàn bộ event flow xuyên 4 services.

### 7.1 — Start tất cả

```bash
# Terminal 1: Pub/Sub Emulator
cd backend && docker compose up -d

# Terminal 2-6: Mỗi service
cd backend/auth-service && npm run dev       # :3004
cd backend/customer-service && npm run dev   # :3001
cd backend/inventory-service && npm run dev  # :3003
cd backend/order-service && npm run dev      # :3002
cd backend/api-gateway && npm run dev        # :3010

# Supabase + Upstash đã chạy sẵn trên cloud — không cần start
```

> Lần chạy đầu: mỗi service `npx prisma migrate deploy` (apply migrations) trước khi `npm run dev`. Auth-service chạy thêm `prisma db seed` để tạo admin mặc định (Phase 6.4) → có user đăng nhập.

### 7.2 — Test Happy Path (qua Gateway)

```
1. POST /api/customers          → tạo customer (credit 10M VND)
2. POST /api/inventory/items    → tạo item SKU-001
3. POST /api/inventory/movements → nhập 100 units
4. POST /api/orders             → tạo draft order
5. POST /api/orders/{id}/submit → saga chạy tự động
6. GET  /api/orders/{id}/lifecycle → verify milestones
```

### 7.3 — Test Compensation

- Order quantity = 999 (vượt stock) → `failed_no_stock`
- Credit vượt limit → `failed_credit` → stock released

### 7.4 — Test Outbox Reliability

- Stop Pub/Sub container → submit order → outbox ghi nhưng chưa publish (record nằm trong Postgres, an toàn)
- Start lại → worker retry → saga tiếp tục

> ⚠️ Pub/Sub Emulator là **in-memory**: restart container → mất sạch topics + subscriptions + message chưa ack. Outbox records (trong Supabase) thì sống sót và sẽ publish lại. Topics/subscriptions được tạo lại lúc service **khởi động** (`autoCreate: true`) — nên sau khi start lại emulator, **restart luôn các service** để chúng tạo lại subscription, nếu không subscriber sẽ không nhận được message mới.

### 7.4b — Verify Observability (kiểm chứng Phase 2.5.6)

- **Trace saga bằng correlation ID**: submit 1 order → lấy `x-correlation-id` từ response header → `grep` ID đó trong log của cả 4 service → phải thấy đủ chuỗi `submitted → reserved → credit-check → confirmed` theo đúng thứ tự thời gian.
- **Health**: `curl /health` từng service → `status: ok` (DB + Redis + Pub/Sub đều up). Thử tắt Pub/Sub Emulator → `/health` chuyển `down` đúng kỳ vọng.
- **Metrics**: `curl /metrics` → kiểm `events_published_total`, `events_consumed_total` tăng sau khi chạy saga; `outbox_lag` về 0 khi worker đã publish hết.

### 7.5 — Commit

```bash
git commit -m "test: e2e saga, outbox reliability, compensation, observability"
```

---

## Phase 8: Frontend Foundation — Next.js + Ant Design

> **Mục tiêu**: Setup Next.js + Ant Design 5 + Tailwind. Layout chung.

### 8.1 — Init Next.js

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir --use-npm
```

### 8.2 — Cài dependencies

```bash
npm install antd @ant-design/icons @ant-design/cssinjs
npm install @tanstack/react-table @tanstack/react-query
npm install recharts react-hook-form @hookform/resolvers zod
npm install framer-motion axios dayjs
```

### 8.3 — Cấu hình Ant Design + Tailwind

- Custom theme tokens
- ConfigProvider wrapper
- Antd = complex components, Tailwind = spacing/layout

### 8.4 — Layout

- `Layout.Sider` — sidebar menu
- `Layout.Header` — breadcrumb
- `Layout.Content` — page content

### 8.5 — API client (có gắn JWT + auto refresh)

Toàn bộ backend yêu cầu JWT → client PHẢI gắn token vào mỗi request, và tự refresh khi 401.

```typescript
const api = axios.create({
  baseURL: 'http://localhost:3010/api',  // Chỉ biết gateway
});

// Request interceptor: gắn access token
api.interceptors.request.use((config) => {
  const token = getAccessToken();           // đọc từ memory/localStorage
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 → thử refresh 1 lần → retry; fail → về /login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true;
      const ok = await tryRefresh();          // POST /api/auth/refresh
      if (ok) return api(error.config);       // retry request cũ
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);
```

### 8.6 — Auth: Login page + AuthContext + Protected routes

> Không có phần này thì mọi màn CRUD ở Phase 9–10 sẽ bị **401**. Phải làm trước Phase 9.

- **Login page** (`/login`): form email + password → `POST /api/auth/login` → lưu `accessToken` + `refreshToken`. Token để ở memory + (tùy chọn) localStorage cho refresh token.
- **AuthContext**: lưu user hiện tại (`{ userId, email, role }` decode từ JWT), expose `login()`, `logout()`, `user`.
- **Protected layout**: middleware/wrapper — chưa đăng nhập → redirect `/login`. Toàn bộ app (trừ `/login`) nằm trong protected layout.
- **RBAC trên UI**: ẩn/disable nút theo `role` (vd: `staff` không thấy nút Delete). Đây chỉ là UX — chốt chặn thật vẫn ở gateway.
- **Logout**: gọi `POST /api/auth/logout` (invalidate refresh token) + clear token client.

### 8.7 — Commit

```bash
git commit -m "feat(frontend): Next.js, Ant Design + Tailwind, layout, API client + auth flow"
```

---

## Phase 9: Customer & Inventory UI

> **Mục tiêu**: CRUD screens.

### 9.1 — Customer List → Table + Search + Pagination
### 9.2 — Customer Create/Edit → React Hook Form + Zod
### 9.3 — Inventory List → Table + Progress bars (stock level)
### 9.4 — Inventory Detail → Tabs: Info | Stock | Movements

### 9.5 — Commit

```bash
git commit -m "feat(frontend): customer and inventory CRUD screens"
```

---

## Phase 10: Order UI — Lifecycle Timeline

> **Mục tiêu**: Order screens + **Lifecycle Timeline** — feature showcase.

### 10.1 — Order List → Table + status badges
### 10.2 — Order Create → Multi-step form (Steps: chọn customer → add items → review)

### 10.3 — Order Detail + Lifecycle Timeline

```tsx
<Steps current={currentStage} items={[
  { title: 'Draft' },
  { title: 'Submitted' },
  { title: 'Stock Reserved' },
  { title: 'Confirmed' },
  { title: 'Fulfilled' },
]} />

<Timeline>
  {events.map(e => (
    <Timeline.Item color={e.color}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {e.title} — {e.timestamp}
      </motion.div>
    </Timeline.Item>
  ))}
</Timeline>
```

### 10.4 — Commit

```bash
git commit -m "feat(frontend): order screens, lifecycle timeline"
```

---

## Phase 11: Dashboard & Polish

### 11.1 — Dashboard: Statistic cards + Recharts (BarChart, PieChart) + Framer Motion
### 11.2 — Polish: Loading/Error/Empty states, responsive
### 11.3 — README.md

### 11.4 — Final commit

```bash
git commit -m "feat(frontend): dashboard, polish, documentation"
```

---

## Phase 12: Advanced Track (TÙY CHỌN) — CDC Analytics Pipeline

> **Mục tiêu**: Xây read model phân tích **bất đồng bộ** bằng CDC — đối lập với `lifecycle_view` (Phase 5.5) update **đồng bộ inline**. Học cách "real-world" build analytics tách khỏi DB giao dịch.
> **Patterns**: Change Data Capture, Async Read Model (CQRS nâng cao), Stream Processing.

> [!WARNING]
> **Nặng máy** — kéo theo Kafka + Debezium + ClickHouse. Tách riêng `docker-compose.cdc.yml`, **KHÔNG** thuộc core prototype. Vẫn **$0** (toàn OSS chạy local). Bỏ qua được nếu chỉ cần validate 6 core patterns — đây là track mở rộng cho ai muốn học CDC.

### 12.1 — Vì sao CDC? (so với `lifecycle_view` inline)

| | `lifecycle_view` (Phase 5.5) | CDC → ClickHouse (phase này) |
|---|---|---|
| Cập nhật read model | Inline, cùng code ghi status | Tự động từ WAL của Postgres |
| Coupling | Order service phải nhớ update view | Zero — analytics không đụng code service |
| Độ trễ | Tức thì | Vài giây (eventual consistency) |
| Hợp cho | Query lifecycle 1 order | Aggregate/report toàn bộ (BI, dashboard) |

→ Hai cách build read model. CDC đúng hơn cho Dashboard khi data lớn / cần tách tải analytics khỏi DB chính.

### 12.2 — Infra: `docker-compose.cdc.yml`

Tách file riêng (chỉ `up` khi học track này):

```yaml
# backend/docker-compose.cdc.yml
services:
  kafka:        # confluentinc/cp-kafka — KRaft mode, không cần Zookeeper
  debezium:     # debezium/connect — đọc WAL Postgres, đẩy change lên Kafka
  clickhouse:   # clickhouse/clickhouse-server — analytics DB
  # (tùy chọn) prometheus + grafana — dashboard cho /metrics ở Phase 2.5.6
```

```bash
docker compose -f docker-compose.cdc.yml up -d
```

### 12.3 — Bật logical replication trên Postgres

- **Supabase**: free tier đã `wal_level=logical`. Tạo publication:
  ```sql
  CREATE PUBLICATION erp_cdc FOR TABLE "order".headers, "order".status_history;
  ```
  Debezium kết nối qua `DIRECT_URL` (port 5432) + replication slot.
- **Hoặc** chạy 1 Postgres local trong compose để học CDC độc lập (đơn giản hơn về quyền replication).

### 12.4 — Đăng ký Debezium connector

`PUT` connector config (idempotent — retry tới khi table tồn tại):

- `connector.class = io.debezium.connector.postgresql.PostgresConnector`
- `table.include.list = order.headers,order.status_history`
- `plugin.name = pgoutput`
- Output topic: `wecare.order.headers` → Kafka.

### 12.5 — ClickHouse: Kafka engine + Materialized View

```sql
-- 1. Bảng đọc từ Kafka
CREATE TABLE order_events_queue (...) ENGINE = Kafka
  SETTINGS kafka_topic_list = 'wecare.order.headers', kafka_format = 'JSONEachRow';

-- 2. Bảng lưu trữ (ReplacingMergeTree — dedup theo version, hợp với CDC upsert)
CREATE TABLE orders_analytics (...) ENGINE = ReplacingMergeTree ORDER BY orderId;

-- 3. Materialized view: tự đẩy từ queue → analytics
CREATE MATERIALIZED VIEW orders_mv TO orders_analytics AS
  SELECT ... FROM order_events_queue;
```

**Concept — ReplacingMergeTree**: CDC gửi cả insert lẫn update; engine này gộp bản ghi trùng key (giữ bản version mới nhất) → read model luôn hội tụ dù message đến trùng/lệch thứ tự.

### 12.6 — Dashboard đọc từ ClickHouse

Chuyển các query aggregate của Dashboard (doanh thu theo ngày, top customer, tỉ lệ order fail) sang ClickHouse thay vì Postgres giao dịch → analytics nặng không còn đụng DB chính.

### 12.7 — Commit

```bash
git commit -m "feat(cdc): optional analytics track — Debezium + Kafka + ClickHouse"
```

---

## Checklist — Patterns đã validate

| # | Pattern | Ở đâu | ☐ |
|---|---|---|---|
| 1 | **DDD Layers** | Customer — domain/application/infrastructure/presentation | ☐ |
| 2 | **Repository** | Tất cả services — interface ở domain, Prisma ở infrastructure | ☐ |
| 3 | **Value Objects** | Customer — TaxCode | ☐ |
| 4 | **Aggregate Root** | Order — OrderHeader quản lý OrderLines | ☐ |
| 5 | **Event-Driven** | Order → Pub/Sub → Inventory | ☐ |
| 6 | **Outbox** | Tất cả services — transactional outbox → Pub/Sub | ☐ |
| 7 | **CQRS** | Order — write (headers) vs read (lifecycle_view) | ☐ |
| 8 | **Saga** | Order submit → reserve → credit check → confirm + compensation | ☐ |
| 9 | **Optimistic Locking** | Inventory — version column | ☐ |
| 10 | **API Gateway** | Gateway route frontend → services | ☐ |
| 11 | **RBAC + JWT** | Auth service — bcrypt, JWT, 3 roles, gateway guard | ☐ |
| 12 | **Idempotent Consumer** | Inventory + Order subscribers — `withIdempotency` (`@erp/shared`) dedup `eventId` qua Redis (`SET NX`) | ☐ |
| 13 | **Shared Contracts (DRY)** | `@erp/shared` — event types + outbox worker + idempotency dùng chung 5 service | ☐ |
| 14 | **Observability** | Correlation ID xuyên saga, `/health` (terminus), `/metrics` (prom-client) | ☐ |
| 15 | **CDC / Async Read Model** *(tùy chọn)* | Phase 12 — Debezium → Kafka → ClickHouse | ☐ |

---

## Timeline

| Phase | Nội dung | Thời gian |
|---|---|---|
| **0** | Chuẩn bị | 0.5 ngày |
| **1** | Khởi tạo repo + folders | 0.5 ngày |
| **1.5** | Viết Docs Blueprint (overview + architecture + api) | 2 ngày |
| **2** | Supabase + Upstash + Pub/Sub Emulator | 0.5 ngày |
| **2.5** | **Shared Library (`@erp/shared`) + Observability foundation** | 1.5 ngày |
| **3** | Customer Service | 2 ngày |
| **4** | Inventory Service | 2 ngày |
| **5** | Order Service (Saga + CQRS) | 3 ngày |
| **6** | Auth Service + API Gateway | 1.5 ngày |
| **7** | Integration Testing | 1 ngày |
| **8** | Frontend Foundation + Auth flow (login, interceptor, protected routes) | 1.5 ngày |
| **9** | Customer & Inventory UI | 1.5 ngày |
| **10** | Order UI + Timeline | 1.5 ngày |
| **11** | Dashboard + Polish | 1 ngày |
| **12** | *(tùy chọn)* Advanced Track — CDC Analytics (Debezium + Kafka + ClickHouse) | 2 ngày |
| **13** | Study Guide (viết sau khi code xong) | 2 ngày |
| | **Tổng** | **~22–24 ngày (core)** + 2 ngày nếu làm CDC track — coi là "ngày tập trung lý tưởng", thực tế nên đệm thêm khi vừa làm vừa học |
