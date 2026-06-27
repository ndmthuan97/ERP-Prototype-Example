---
type: System Component
title: "Sales Service"
description: "Sales order lifecycle with Saga submit flow, CQRS, Aggregate Root, Delivery Order 6-state, Sales Return, and Circuit Breaker"
resource: "http://localhost:3002"
tags: [system, component, sales, saga, cqrs, aggregate-root]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Sales Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3002` |
| **Schema** | `sales` |
| **Vai trò** | Core Context — trung tâm nghiệp vụ, quản lý đơn hàng |
| **Patterns** | DDD, Aggregate Root, CQRS, Saga (HTTP sync), Outbox, Circuit Breaker, Event-driven |

Sales Service là trung tâm nghiệp vụ. Khi submit đơn hàng: HTTP reserve stock (Inventory) → HTTP credit-check (Customer) → confirm/cancel. Hỗ trợ Delivery Order (6-state lifecycle) và Sales Return.

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `sales` — headers, lines, status_history, delivery, returns, outbox |
| GCP Pub/Sub Emulator | External | Publish: sales-order.submitted/confirmed/cancelled/fulfilled |
| Inventory Service | Internal (outbound HTTP) | Reserve/release stock (batch endpoints) |
| Customer Service | Internal (outbound HTTP) | Credit check |
| `opossum` | Library | Circuit Breaker cho HTTP calls tới Inventory + Customer |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PUBSUB_EMULATOR_HOST` | ✅ | Pub/Sub Emulator host |
| `INVENTORY_SERVICE_URL` | ✅ | URL của Inventory Service (e.g., `http://localhost:3003`) |
| `CUSTOMER_SERVICE_URL` | ✅ | URL của Customer Service (e.g., `http://localhost:3001`) |

## Key Resources

- **API Reference**: [order-endpoints.md](../api/order-endpoints.md)
- **Bounded Context**: [bounded-contexts.md §3.3](../architecture/bounded-contexts.md)
- **Data Model**: [data-model.md §4](../architecture/data-model.md)
- **Event Flows**: [event-flows.md §4](../architecture/event-flows.md)
- **Business Flows**: [flows.md](../flows.md) — Flow 2 (Sales Saga), Flow 3 (Delivery), Flow 4 (Return)
- **Design Patterns**: [design-patterns.md §4, §7, §8](../architecture/design-patterns.md) — Aggregate Root, CQRS, Saga
- **Business Requirements**: [business-requirements.md §3.2](../overview/business-requirements.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Customer Service](./customer-service.md) — HTTP credit-check
- [Inventory Service](./inventory-service.md) — HTTP reserve/release, event compensation
- [Catalog Service](./catalog-service.md) — product data for order lines
