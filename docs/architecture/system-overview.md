# System Overview — Kiến trúc tổng quan

> Tài liệu mô tả kiến trúc tổng thể của ERP Prototype.
> Liên quan: [bounded-contexts](bounded-contexts.md) · [data-model](data-model.md) · [event-flows](event-flows.md) · [design-patterns](design-patterns.md)

---

## 1. Luồng Request — Frontend đến Backend

```mermaid
flowchart TB
    Browser[Browser]
    Frontend["Frontend :3000"]
    Gateway["API Gateway :3010"]

    Browser --> Frontend
    Frontend -- "HTTP REST" --> Gateway
```

---

## 2. API Gateway — Routing

Gateway nhận request từ frontend → verify JWT → check role → forward đến service đúng.

```mermaid
flowchart TB
    Gateway["API Gateway :3010"]

    Auth["Auth Service :3004"]
    Customer["Customer Service :3001"]
    Order["Order Service :3002"]
    Inventory["Inventory Service :3003"]

    Gateway -- "/api/auth/*" --> Auth
    Gateway -- "/api/customers/*" --> Customer
    Gateway -- "/api/orders/*" --> Order
    Gateway -- "/api/inventory/*" --> Inventory
```

---

## 3. Services → Database

Mỗi service có schema riêng trong cùng 1 Supabase PostgreSQL instance. Không cross-schema query.

```mermaid
flowchart TB
    Auth["Auth Service :3004"]
    Customer["Customer Service :3001"]
    Order["Order Service :3002"]
    Inventory["Inventory Service :3003"]

    AuthDB["schema: auth"]
    CustDB["schema: customer"]
    OrdDB["schema: order"]
    InvDB["schema: inventory"]

    Auth --> AuthDB
    Customer --> CustDB
    Order --> OrdDB
    Inventory --> InvDB
```

---

## 4. Services → Pub/Sub (Event-driven)

3 business services publish events qua outbox → Pub/Sub Emulator. Order và Inventory subscribe lẫn nhau (Saga).

```mermaid
flowchart LR
    Customer["Customer Service"]
    Order["Order Service"]
    Inventory["Inventory Service"]
    PubSub["Pub/Sub Emulator :8085"]

    Customer -- "publish" --> PubSub
    Order -- "publish" --> PubSub
    Inventory -- "publish" --> PubSub

    PubSub -. "subscribe" .-> Order
    PubSub -. "subscribe" .-> Inventory
```

---

## 5. Services → Redis (Cache)

```mermaid
flowchart LR
    Customer["Customer Service"]
    Order["Order Service"]
    Inventory["Inventory Service"]
    Redis["Upstash Redis"]

    Customer -. "cache" .-> Redis
    Order -. "cache" .-> Redis
    Inventory -. "cache" .-> Redis
```

---

## 6. Tech Stack

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

## 7. Service Map — 5 services

| Service | Port | Schema | Patterns chính |
|---|---|---|---|
| **API Gateway** | 3010 | — | JWT Guard, RBAC, Reverse Proxy |
| **Auth Service** | 3004 | `auth` | bcrypt, JWT, Refresh Token |
| **Customer Service** | 3001 | `customer` | DDD layers, Repository, Value Object, Outbox |
| **Order Service** | 3002 | `order` | Aggregate Root, Saga, CQRS, Outbox |
| **Inventory Service** | 3003 | `inventory` | Optimistic Locking, CHECK constraint, Outbox |

---

## 8. Luồng Request chi tiết — JWT Authentication

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend :3000
    participant GW as Gateway :3010
    participant Auth as Auth :3004
    participant Svc as Service

    User->>FE: Click action
    FE->>GW: Authorization: Bearer JWT

    alt Public route
        GW->>Auth: Forward thẳng
        Auth-->>GW: Response
    else Protected route
        GW->>GW: Verify JWT
        alt JWT invalid
            GW-->>FE: 401 Unauthorized
        else JWT valid
            GW->>GW: Check role
            alt Không đủ quyền
                GW-->>FE: 403 Forbidden
            else OK
                GW->>Svc: Forward + x-user-id, x-user-role
                Svc-->>GW: Response
            end
        end
    end

    GW-->>FE: Response
    FE-->>User: Render UI
```

---

## 9. Luồng Event — Saga (Order Submit)

```mermaid
sequenceDiagram
    actor User
    participant Order as Order Service
    participant PS as Pub/Sub
    participant Inv as Inventory Service
    participant Cust as Customer Service

    User->>Order: POST /orders/{id}/submit
    Order->>Order: status = submitted
    Order->>Order: Ghi outbox
    Order-->>User: 200 OK

    Note over Order,PS: Outbox Worker poll 2s
    Order->>PS: order.submitted

    PS->>Inv: order.submitted
    Inv->>Inv: Reserve stock

    alt Đủ stock
        Inv->>PS: inventory.reserved
        PS->>Order: inventory.reserved
        Order->>Cust: credit-check
        alt Credit OK
            Order->>Order: status = confirmed
        else Credit FAIL
            Order->>PS: order.cancelled
            PS->>Inv: order.cancelled
            Inv->>Inv: Release stock
        end
    else Thiếu stock
        Inv->>PS: reservation-failed
        PS->>Order: reservation-failed
        Order->>Order: status = failed
    end
```

---

## 10. Database — 4 Schemas

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role
        boolean is_active
    }

    CUSTOMER_CORES {
        uuid id PK
        string business_name
        string tax_code
        string status
        decimal credit_limit
    }

    ORDER_HEADERS {
        uuid id PK
        uuid customer_id FK
        string status
        decimal total_amount
    }

    ORDER_LINES {
        uuid id PK
        uuid header_id FK
        string item_id
        int quantity
        decimal unit_price
    }

    STOCK_LEVELS {
        uuid id PK
        string item_id FK
        int on_hand
        int reserved
        int version
    }

    ORDER_HEADERS ||--o{ ORDER_LINES : "has lines"
```

| Schema | Service sở hữu | Tables chính |
|---|---|---|
| `auth` | Auth Service | users, refresh_tokens |
| `customer` | Customer Service | cores, outbox |
| `order` | Order Service | headers, lines, status_history, lifecycle_view, outbox |
| `inventory` | Inventory Service | items, warehouses, stock_levels, movements, reservations, outbox |

**Quy tắc**: Mỗi service CHỈ đọc/ghi schema của mình. Cần data từ context khác → HTTP API hoặc event.

---

## 11. Outbox Pattern

```mermaid
flowchart LR
    A["1. Write data"] --> B["2. Write outbox"]
    B --> C["3. Worker poll"]
    C --> D["4. Publish Pub/Sub"]
    D --> E["5. Mark published"]
```

**Tại sao Outbox?**: Ghi event vào DB **cùng transaction** với business data → worker poll và publish sau → **zero event loss**.

Nếu publish trực tiếp (ngoài transaction):
- Data saved nhưng event lost (Pub/Sub down)
- Event published nhưng data rollback (transaction fail)

---

## 12. RBAC — 3 Roles

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
| **Xem reports** | ✅ | ✅ | 👁️ |

---

## 13. Deployment — Local Development

```
Developer Machine
├── npm run dev
│   ├── Auth Service         :3004
│   ├── Customer Service     :3001
│   ├── Order Service        :3002
│   ├── Inventory Service    :3003
│   ├── API Gateway          :3010
│   └── Frontend (Next.js)   :3000
│
├── Docker
│   └── Pub/Sub Emulator     :8085
│
└── Cloud (Free Tier)
    ├── Supabase PostgreSQL   (Singapore)
    └── Upstash Redis         (Singapore)
```

**Startup:**
```bash
# 1. Pub/Sub Emulator
cd backend; docker compose up -d

# 2. Services (mỗi terminal riêng)
cd backend/auth-service; npm run dev        # :3004
cd backend/customer-service; npm run dev    # :3001
cd backend/order-service; npm run dev       # :3002
cd backend/inventory-service; npm run dev   # :3003
cd backend/api-gateway; npm run dev         # :3010

# 3. Frontend
cd frontend; npm run dev                    # :3000
```

---

## 14. Patterns × Services

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
