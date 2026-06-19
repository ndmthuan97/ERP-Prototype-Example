# 🏛️ System Overview — Kiến trúc tổng quan

> Tài liệu mô tả kiến trúc tổng thể của ERP Prototype.
> Liên quan: [bounded-contexts](bounded-contexts.md) · [data-model](data-model.md) · [event-flows](event-flows.md) · [design-patterns](design-patterns.md)

---

## 1. Sơ đồ kiến trúc tổng thể

```mermaid
flowchart TB
    subgraph CLIENT["🌐 Client"]
        Browser["Browser"]
    end

    subgraph FE["Frontend (:3000)"]
        NextJS["Next.js 15<br/>Ant Design 5 + Tailwind CSS"]
    end

    subgraph GW["API Gateway (:3010)"]
        Gateway["NestJS Gateway"]
        JWTGuard["JWT Guard + RBAC"]
    end

    subgraph SERVICES["Backend Services"]
        direction LR
        Auth["Auth Service<br/>(:3004)"]
        Customer["Customer Service<br/>(:3001)"]
        Order["Order Service<br/>(:3002)"]
        Inventory["Inventory Service<br/>(:3003)"]
    end

    subgraph INFRA["Infrastructure"]
        direction LR
        DB[("Supabase<br/>PostgreSQL<br/>4 schemas")]
        Redis[("Upstash<br/>Redis")]
        PubSub["GCP Pub/Sub<br/>Emulator<br/>(Docker)"]
    end

    Browser --> NextJS
    NextJS -- "HTTP REST" --> Gateway
    Gateway --> JWTGuard
    JWTGuard -- "verify JWT" --> Auth
    JWTGuard -- "forward" --> Customer
    JWTGuard -- "forward" --> Order
    JWTGuard -- "forward" --> Inventory

    Auth --> DB
    Customer --> DB
    Order --> DB
    Inventory --> DB

    Customer -.-> Redis
    Order -.-> Redis
    Inventory -.-> Redis

    Order -- "publish events" --> PubSub
    Customer -- "publish events" --> PubSub
    Inventory -- "publish events" --> PubSub
    PubSub -- "subscribe" --> Order
    PubSub -- "subscribe" --> Inventory

    style CLIENT fill:#1a1a2e,stroke:#e94560,color:#fff
    style FE fill:#16213e,stroke:#0f3460,color:#fff
    style GW fill:#0f3460,stroke:#533483,color:#fff
    style SERVICES fill:#533483,stroke:#e94560,color:#fff
    style INFRA fill:#1a1a2e,stroke:#0f3460,color:#fff
```

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

```mermaid
flowchart LR
    subgraph GATEWAY["API Gateway :3010"]
        GW_ROLE["JWT verify<br/>RBAC check<br/>Proxy routing"]
    end

    subgraph AUTH["Auth Service :3004"]
        AUTH_ROLE["Schema: auth<br/>─────────────<br/>• Login / Register<br/>• JWT sign / verify<br/>• Refresh token<br/>• User management"]
    end

    subgraph CUST["Customer Service :3001"]
        CUST_ROLE["Schema: customer<br/>─────────────<br/>• Customer CRUD<br/>• Credit check<br/>• Tax code validation<br/>• Outbox → events"]
    end

    subgraph ORD["Order Service :3002"]
        ORD_ROLE["Schema: order<br/>─────────────<br/>• Order lifecycle<br/>• Aggregate Root<br/>• Saga orchestration<br/>• CQRS read model<br/>• Outbox → events"]
    end

    subgraph INV["Inventory Service :3003"]
        INV_ROLE["Schema: inventory<br/>─────────────<br/>• Stock management<br/>• Optimistic locking<br/>• Reserve / Release<br/>• Movement log<br/>• Outbox → events"]
    end

    GW_ROLE -- "verify" --> AUTH_ROLE
    GW_ROLE --> CUST_ROLE
    GW_ROLE --> ORD_ROLE
    GW_ROLE --> INV_ROLE

    style GATEWAY fill:#0f3460,color:#fff
    style AUTH fill:#e94560,color:#fff
    style CUST fill:#533483,color:#fff
    style ORD fill:#0f3460,color:#fff
    style INV fill:#16213e,color:#fff
```

| Service | Port | Schema | Patterns chính |
|---|---|---|---|
| **API Gateway** | 3010 | — | JWT Guard, RBAC, Reverse Proxy |
| **Auth Service** | 3004 | `auth` | bcrypt, JWT, Refresh Token |
| **Customer Service** | 3001 | `customer` | DDD layers, Repository, Value Object, Outbox |
| **Order Service** | 3002 | `order` | Aggregate Root, Saga, CQRS, Outbox |
| **Inventory Service** | 3003 | `inventory` | Optimistic Locking, CHECK constraint, Outbox |

---

## 4. Luồng Request (HTTP)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend<br/>:3000
    participant GW as API Gateway<br/>:3010
    participant Auth as Auth Service<br/>:3004
    participant Svc as Target Service

    User->>FE: Click action
    FE->>GW: HTTP request<br/>Authorization: Bearer <JWT>

    alt Public route (/auth/login, /auth/refresh)
        GW->>Auth: Forward trực tiếp
        Auth-->>GW: Response
    else Protected route
        GW->>GW: Verify JWT (signature + expiry)
        alt JWT invalid / expired
            GW-->>FE: 401 Unauthorized
        else JWT valid
            GW->>GW: Check role permission
            alt Role không đủ quyền
                GW-->>FE: 403 Forbidden
            else Role OK
                GW->>Svc: Forward request<br/>+ Header: x-user-id, x-user-role
                Svc-->>GW: Response
            end
        end
    end

    GW-->>FE: Response
    FE-->>User: Render UI
```

---

## 5. Luồng Event (Pub/Sub) — Saga Flow

```mermaid
sequenceDiagram
    participant User
    participant OrderSvc as Order Service
    participant PubSub as Pub/Sub
    participant InvSvc as Inventory Service
    participant CustSvc as Customer Service

    User->>OrderSvc: POST /orders/{id}/submit
    OrderSvc->>OrderSvc: status = 'submitted'
    OrderSvc->>OrderSvc: Ghi outbox (cùng transaction)
    OrderSvc-->>User: 200 OK

    Note over OrderSvc,PubSub: Outbox Worker (poll 2s)
    OrderSvc->>PubSub: publish: order.submitted

    PubSub->>InvSvc: subscribe: order.submitted
    InvSvc->>InvSvc: Reserve stock (optimistic lock)

    alt ✅ Đủ stock
        InvSvc->>PubSub: publish: inventory.reserved
        PubSub->>OrderSvc: subscribe: inventory.reserved
        OrderSvc->>CustSvc: HTTP GET /customers/{id}/credit-check
        alt ✅ Credit OK
            OrderSvc->>OrderSvc: status = 'confirmed'
            OrderSvc->>PubSub: publish: order.confirmed
        else ❌ Credit FAIL
            OrderSvc->>OrderSvc: status = 'failed_credit'
            OrderSvc->>PubSub: publish: order.cancelled
            PubSub->>InvSvc: subscribe: order.cancelled
            InvSvc->>InvSvc: Release reserved stock
        end
    else ❌ Thiếu stock
        InvSvc->>PubSub: publish: inventory.reservation-failed
        PubSub->>OrderSvc: subscribe: inventory.reservation-failed
        OrderSvc->>OrderSvc: status = 'failed_no_stock'
    end
```

---

## 6. Database Architecture — 4 Schemas, 1 Instance

```mermaid
erDiagram
    AUTH_SCHEMA {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role "admin | manager | staff"
        boolean is_active
    }

    CUSTOMER_SCHEMA {
        uuid id PK
        string business_name
        string tax_code
        string status "prospect | active | suspended | archived"
        decimal credit_limit_amount
        string contact_name
        string contact_phone
    }

    ORDER_SCHEMA_HEADER {
        uuid id PK
        uuid customer_id FK
        string status "draft | submitted | confirmed | cancelled | fulfilled"
        decimal total_amount
        string cancel_reason
    }

    ORDER_SCHEMA_LINE {
        uuid id PK
        uuid header_id FK
        string item_id
        int quantity
        decimal unit_price
    }

    INVENTORY_SCHEMA_STOCK {
        uuid id PK
        string item_id FK
        string warehouse_id FK
        int on_hand_quantity "CHECK >= 0"
        int reserved_quantity "CHECK >= 0"
        int version "Optimistic Lock"
    }

    ORDER_SCHEMA_HEADER ||--o{ ORDER_SCHEMA_LINE : "has lines"
```

**4 schemas trong 1 Supabase PostgreSQL instance:**

| Schema | Service sở hữu | Tables chính |
|---|---|---|
| `auth` | Auth Service | users, refresh_tokens |
| `customer` | Customer Service | cores, outbox |
| `order` | Order Service | headers, lines, status_history, lifecycle_view, outbox |
| `inventory` | Inventory Service | items, warehouses, stock_levels, movements, reservations, outbox |

**Quy tắc**: Mỗi service CHỈ đọc/ghi schema của mình. Không cross-schema query. Cần data từ context khác → gọi qua HTTP API hoặc lắng nghe event.

---

## 7. Outbox Pattern — Guaranteed Event Delivery

```mermaid
flowchart LR
    subgraph TX["DB Transaction"]
        BIZ["1. Write business data"]
        OBX["2. Write outbox record"]
    end

    subgraph WORKER["Outbox Worker (poll 2s)"]
        POLL["3. SELECT unpublished"]
        PUB["4. Publish to Pub/Sub"]
        MARK["5. UPDATE published_at"]
    end

    subgraph PS["Pub/Sub"]
        TOPIC["Topic"]
        SUB["Subscription"]
    end

    BIZ --> OBX
    OBX --> POLL
    POLL --> PUB
    PUB --> TOPIC
    TOPIC --> SUB
    PUB --> MARK

    style TX fill:#0f3460,color:#fff
    style WORKER fill:#533483,color:#fff
    style PS fill:#e94560,color:#fff
```

**Tại sao Outbox?**: Nếu publish event trực tiếp lên Pub/Sub (ngoài transaction), có thể xảy ra:
- Data saved nhưng event lost (Pub/Sub down)
- Event published nhưng data rollback (transaction fail)

Outbox giải quyết bằng cách ghi event vào DB **cùng transaction** với business data → worker poll và publish sau → **zero event loss**.

---

## 8. RBAC — 3 Roles

| Thao tác | `admin` | `manager` | `staff` |
|---|:---:|:---:|:---:|
| **Quản lý users** | ✅ | ❌ | ❌ |
| **Tạo customer** | ✅ | ✅ | ✅ |
| **Sửa/xóa customer** | ✅ | ✅ | ❌ |
| **Tạo order** | ✅ | ✅ | ✅ |
| **Submit/cancel order** | ✅ | ✅ | ❌ |
| **Confirm order** | ✅ | ✅ | ❌ |
| **Tạo item** | ✅ | ✅ | ✅ |
| **Nhập/xuất stock** | ✅ | ✅ | ❌ |
| **Xem dashboard** | ✅ | ✅ | ✅ |
| **Xem reports** | ✅ | ✅ | 👁️ (read-only) |

---

## 9. Deployment — Local Development

```
┌─────────────────────────────────────────────────────────┐
│  Developer Machine                                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Auth     │  │ Customer │  │ Order    │              │
│  │ :3004    │  │ :3001    │  │ :3002    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Inventory│  │ Gateway  │  │ Frontend │              │
│  │ :3003    │  │ :3010    │  │ :3000    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌──────────────────┐                                    │
│  │ Docker            │                                   │
│  │ Pub/Sub Emulator  │                                   │
│  │ :8085             │                                   │
│  └──────────────────┘                                    │
│                                                          │
├──────────── Cloud (Free Tier) ──────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Supabase          │  │ Upstash           │            │
│  │ PostgreSQL        │  │ Redis             │            │
│  │ (Singapore)       │  │ (Singapore)       │            │
│  └──────────────────┘  └──────────────────┘             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Startup:**
```bash
# 1. Pub/Sub Emulator
cd backend && docker compose up -d

# 2. Services (mỗi terminal riêng)
cd backend/auth-service && npm run dev       # :3004
cd backend/customer-service && npm run dev   # :3001
cd backend/order-service && npm run dev      # :3002
cd backend/inventory-service && npm run dev  # :3003
cd backend/api-gateway && npm run dev        # :3010

# 3. Frontend
cd frontend && npm run dev                   # :3000

# Supabase + Upstash chạy sẵn trên cloud
```

---

## 10. Tổng hợp — Patterns × Services

| Pattern | Auth | Customer | Order | Inventory | Gateway |
|---|:---:|:---:|:---:|:---:|:---:|
| DDD Layers | — | ✅ | ✅ | ✅ | — |
| Repository | — | ✅ | ✅ | ✅ | — |
| Value Object | — | ✅ | — | — | — |
| Aggregate Root | — | — | ✅ | — | — |
| Outbox | — | ✅ | ✅ | ✅ | — |
| Event-Driven | — | ✅ | ✅ | ✅ | — |
| CQRS | — | — | ✅ | — | — |
| Saga | — | — | ✅ | ✅ | — |
| Optimistic Lock | — | — | — | ✅ | — |
| JWT + RBAC | ✅ | — | — | — | ✅ |
