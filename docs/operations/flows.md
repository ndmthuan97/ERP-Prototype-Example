---
type: Reference
title: "ERP System Flows"
description: "Sequence diagrams for 6 main business flows and 3 compensation/error flows"
tags: [reference, flows, saga, sequence-diagram]
timestamp: "2026-07-08T00:00:00+07:00"
---

# 🔄 ERP System Flows

> Cập nhật: **2026-06-25** | **6 luồng chính** + **3 luồng compensation**

---

## Flow 1: Authentication

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant IdP as Identity Platform (Firebase)
    participant GW as API Gateway
    participant Auth as Auth Service
    participant RD as Redis

    FE->>IdP: signInWithPopup (Google)
    IdP-->>FE: Firebase ID token
    FE->>GW: POST /api/auth/sso/callback {idToken}
    GW->>Auth: Forward (public, no app token)
    Auth->>Auth: verify ID token + allowlist email + tạo session
    Auth-->>FE: {accessToken (app token HS256, sid), user}

    FE->>GW: GET /api/customers (Bearer app token)
    GW->>GW: jwt.verify HS256 → getex session:sid (Redis)
    GW->>GW: attach x-user-*, x-user-sid → proxy

    FE->>GW: POST /api/auth/logout (Bearer)
    GW->>Auth: Forward + x-user-sid
    Auth->>RD: DEL session:sid → 204 (revoke tức thì)
```

---

## Flow 2: Sales Order Saga ⭐

```mermaid
sequenceDiagram
    participant User
    participant SO as Sales Service
    participant INV as Inventory Service
    participant CUS as Customer Service

    User->>SO: POST /orders → draft
    User->>SO: POST /orders/:id/lines (qty, price, taxRate)
    User->>SO: POST /orders/:id/submit → submitted
    SO->>INV: Event "sales-order.submitted"
    INV->>INV: reserve(items)
    alt Reserve OK
        INV->>SO: Event "inventory.reserved"
        SO->>CUS: GET /credit-check
        alt Credit OK
            SO->>SO: confirm() → confirmed ✅
        else Credit FAIL
            SO->>SO: cancelled ❌ + release stock
        end
    else Reserve FAIL
        INV->>SO: Event "reservation-failed"
        SO->>SO: cancelled ❌
    end
```

**SO States:** `draft → submitted → confirmed → partially_delivered → fully_delivered | cancelled`

---

## Flow 3: Delivery + Partial Delivery

```mermaid
sequenceDiagram
    participant User
    participant DO as DeliveryOrder
    participant SO as SalesOrder

    Note over SO: confirmed (A:10, B:5)
    User->>DO: Create DO#1 (A:6, B:5)
    DO->>DO: draft→picking→packed→shipped→delivered
    DO->>SO: recordDelivery(false) → partially_delivered

    User->>DO: Create DO#2 (A:4)
    DO->>DO: draft→picking→packed→shipped→delivered
    DO->>SO: recordDelivery(true) → fully_delivered ✅
```

**DO States:** `draft → picking → packed → shipped → delivered | failed`

---

## Flow 4: Sales Return

```mermaid
sequenceDiagram
    participant User
    participant RET as SalesReturn

    Note over RET: SO must be fully_delivered
    User->>RET: POST /orders/:id/returns {reason, lines}
    User->>RET: approve → goods_received → complete ✅
```

**Return States:** `draft → approved → goods_received → completed | rejected`

---

## Flow 5: Purchasing + Goods Receipt

```mermaid
sequenceDiagram
    participant User
    participant PO as Purchasing
    participant INV as Inventory

    User->>PO: Create supplier + PO + lines
    User->>PO: place → placed
    User->>PO: receive goods
    PO->>INV: Event "goods.received"
    INV->>INV: receive() → available ↑
```

**PO States:** `draft → placed → partially_received → received | cancelled`

---

## Flow 6: Catalog + Inventory Setup

```mermaid
sequenceDiagram
    participant User
    participant CAT as Catalog
    participant INV as Inventory

    User->>CAT: POST /catalog {sku, name, price, taxRate}
    User->>INV: POST /inventory {sku, name}
    User->>INV: POST /inventory/:id/receive {qty: 100}
```

---

## Flow 7-9: Compensation & Errors

| # | Scenario | Trigger | Result |
|---|----------|---------|--------|
| 7 | Insufficient stock | reserve() fails | SO → cancelled, reason "tồn kho" |
| 8 | Insufficient credit | credit-check returns canOrder=false | SO → cancelled + stock released |
| 9 | Delivery failed | markFailed(reason) from shipped | DO → failed, SO unchanged |

---

## API Route Map

| Gateway Route | Service | Description |
|--------------|---------|-------------|
| `POST /api/auth/sso/callback` | Auth :3004 | Google sign-in → app token HS256 |
| `POST /api/auth/logout` | Auth :3004 | Đăng xuất (revoke session) |
| `GET/POST /api/customers` | Customer :3001 | Customer CRUD |
| `GET /api/customers/:id/credit-check` | Customer :3001 | Credit check |
| `POST /api/orders` | Sales :3002 | Create SO |
| `POST /api/orders/:id/lines` | Sales :3002 | Add line |
| `POST /api/orders/:id/submit` | Sales :3002 | Submit SO |
| `POST /api/orders/:id/cancel` | Sales :3002 | Cancel SO |
| `POST /api/orders/:id/deliveries` | Sales :3002 | Create DO |
| `POST .../deliveries/:doId/start-picking\|pack\|ship\|deliver\|fail` | Sales | DO transitions |
| `POST /api/orders/:id/returns` | Sales :3002 | Create return |
| `POST .../returns/:retId/approve\|reject\|receive-goods\|complete` | Sales | Return transitions |
| `GET/POST /api/inventory` | Inventory :3003 | Stock CRUD |
| `POST /api/inventory/:id/receive` | Inventory :3003 | Receive stock |
| `GET/POST /api/catalog` | Catalog :3005 | Product CRUD |
| `GET/POST /api/purchasing` | Purchasing :3006 | PO CRUD |
| `GET/POST /api/suppliers` | Purchasing :3006 | Supplier CRUD |
