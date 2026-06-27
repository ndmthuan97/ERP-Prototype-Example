---
type: System Component
title: "Purchasing Service"
description: "Purchase Order lifecycle (draft→placed→received), Supplier CRUD, goods receipt with Outbox event to Inventory"
resource: "http://localhost:3006"
tags: [system, component, purchasing, po, supplier]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Purchasing Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3006` |
| **Schema** | `purchasing` |
| **Vai trò** | Extended Context — quản lý quy trình mua hàng |
| **Patterns** | DDD 4 layers, Outbox, Event-driven |

Purchasing Service quản lý Purchase Orders (PO) và Suppliers. PO lifecycle: draft → placed → received. Khi nhận hàng (receive), publish event `goods.received` → Inventory Service tự động tăng stock.

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `purchasing` — purchase_orders, po_lines, suppliers, outbox |
| GCP Pub/Sub Emulator | External | Publish: goods.received |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PUBSUB_EMULATOR_HOST` | ✅ | Pub/Sub Emulator host |

## Key Resources

- **API Reference**: [purchasing-endpoints.md](../api/purchasing-endpoints.md)
- **Data Model**: [data-model.md](../architecture/data-model.md)
- **Business Flows**: [flows.md](../flows.md) — Flow 5 (Purchasing → Inventory)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Inventory Service](./inventory-service.md) — subscribes to goods.received
- [Catalog Service](./catalog-service.md) — PO lines reference product items
