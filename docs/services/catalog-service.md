---
type: System Component
title: "Catalog Service"
description: "Product catalog management with SKU validation, taxRate per product (VN rates), activate/deactivate, and Outbox events"
resource: "http://localhost:3005"
tags: [system, component, catalog, product, sku]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Catalog Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3005` |
| **Schema** | `catalog` |
| **Vai trò** | Extended Context — quản lý danh mục sản phẩm |
| **Patterns** | DDD 4 layers, Outbox, Event-driven, SKU Value Object |

Catalog Service quản lý product catalog. Khi tạo product mới, publish event `product.created` → Inventory Service tự động tạo stock item tương ứng. Hỗ trợ 4 mức thuế suất VN (0%, 5%, 8%, 10%).

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `catalog` — products, outbox |
| GCP Pub/Sub Emulator | External | Publish: product.created, product.deactivated |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PUBSUB_EMULATOR_HOST` | ✅ | Pub/Sub Emulator host |

## Key Resources

- **API Reference**: [catalog-endpoints.md](../api/catalog-endpoints.md)
- **Data Model**: [data-model.md](../architecture/data-model.md)
- **Business Flows**: [flows.md](../flows.md) — Flow 6 (Catalog → Inventory)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Inventory Service](./inventory-service.md) — subscribes to product.created
- [Purchasing Service](./purchasing-service.md) — PO lines reference product items
- [Sales Service](./sales-service.md) — order lines reference product data
