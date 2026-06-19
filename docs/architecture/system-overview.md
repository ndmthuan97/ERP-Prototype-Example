# System Overview — Kiến trúc tổng quan

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
    Ord["Order :3002"]
    Inv["Inventory :3003"]

    DB[("Supabase PostgreSQL — 4 schemas")]
    PS["Pub/Sub Emulator :8085"]
    RD[("Upstash Redis")]

    Browser --> FE
    FE -- "HTTP" --> GW

    GW -- "verify" --> Auth
    GW --> Cust
    GW --> Ord
    GW --> Inv

    Auth --> DB
    Cust --> DB
    Ord --> DB
    Inv --> DB

    Cust -- "publish" --> PS
    Ord -- "publish" --> PS
    Inv -- "publish" --> PS

    PS -. "subscribe" .-> Ord
    PS -. "subscribe" .-> Inv

    Cust -. "cache" .-> RD
    Ord -. "cache" .-> RD
    Inv -. "cache" .-> RD
```

**Đọc sơ đồ:**
- **Đường liền** (→) = HTTP request
- **Đường đứt** (-.→) = event subscribe / cache
- Tất cả services nối thẳng xuống DB — mỗi service chỉ truy cập schema của mình
- Pub/Sub: 3 services publish events, Order + Inventory subscribe lẫn nhau (Saga)

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

| Service | Port | Schema | Patterns chính |
|---|---|---|---|
| **API Gateway** | 3010 | — | JWT Guard, RBAC, Reverse Proxy |
| **Auth Service** | 3004 | `auth` | bcrypt, JWT, Refresh Token |
| **Customer Service** | 3001 | `customer` | DDD layers, Repository, Value Object, Outbox |
| **Order Service** | 3002 | `order` | Aggregate Root, Saga, CQRS, Outbox |
| **Inventory Service** | 3003 | `inventory` | Optimistic Locking, CHECK constraint, Outbox |

---

## 4. Luồng Request chi tiết — JWT Authentication

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

## 5. Luồng Event — Saga (Order Submit)

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

## 6. Database — 4 Schemas

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

## 7. Outbox Pattern

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
| **Xem reports** | ✅ | ✅ | 👁️ |

---

## 9. Deployment — Local Development

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

## 10. Patterns × Services

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
