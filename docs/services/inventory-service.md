---
type: System Component
title: "Inventory Service"
description: "Stock management with Optimistic Locking, batch reserve/release, movement tracking, and multi-source event subscribers"
resource: "http://localhost:3003"
tags: [system, component, inventory, optimistic-locking, stock]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Inventory Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3003` |
| **Schema** | `inventory` |
| **Vai trò** | Core Context — quản lý kho hàng, tồn kho |
| **Patterns** | DDD, Repository, Optimistic Locking (version + retry), Outbox, Event-driven (subscriber) |

Inventory Service quản lý stock levels, movements, và hỗ trợ batch reserve/release cho Sales Service. Là subscriber chính: nhận events từ Sales (cancel, fulfill), Catalog (product.created), Purchasing (goods.received).

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `inventory` — items, movements, outbox |
| GCP Pub/Sub Emulator | External | Subscribe: sales-order.cancelled, sales-order.fulfilled, product.created, goods.received |
| Sales Service | Internal (inbound HTTP) | Batch reserve/release endpoints |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | ✅ | Redis (idempotency check for events) |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Redis token |
| `PUBSUB_EMULATOR_HOST` | ✅ | Pub/Sub Emulator host |

## Key Resources

- **API Reference**: [inventory-endpoints.md](../api/inventory-endpoints.md)
- **Bounded Context**: [bounded-contexts.md §3.4](../architecture/bounded-contexts.md)
- **Data Model**: [data-model.md §5](../architecture/data-model.md)
- **Event Flows**: [event-flows.md §2-4](../architecture/event-flows.md) — subscriber side
- **Design Patterns**: [design-patterns.md §9](../architecture/design-patterns.md) — Optimistic Locking
- **Business Requirements**: [business-requirements.md §3.3](../overview/business-requirements.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Sales Service](./sales-service.md) — HTTP reserve/release, event compensation
- [Catalog Service](./catalog-service.md) — product.created → auto-create stock item
- [Purchasing Service](./purchasing-service.md) — goods.received → increase stock
