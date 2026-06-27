---
type: System Component
title: "Customer Service"
description: "B2B customer management with credit check, DDD 4 layers, Value Object (TaxCode), Cache-Aside, and Outbox pattern"
resource: "http://localhost:3001"
tags: [system, component, customer, ddd, value-object]
timestamp: "2026-06-26T00:00:00+07:00"
---

# Customer Service

## Overview

| Thuộc tính | Chi tiết |
|-----------|---------|
| **Port** | `:3001` |
| **Schema** | `customer` |
| **Vai trò** | Core Context — quản lý khách hàng B2B, credit limit |
| **Patterns** | DDD 4 layers, Repository, Value Object (TaxCode), Outbox, Cache-Aside, CQRS-lite |

Customer Service là bounded context đầu tiên trong hệ thống. Quản lý thông tin khách hàng doanh nghiệp (B2B), bao gồm credit limit — khi Sales Service submit đơn hàng, sẽ HTTP call credit-check endpoint.

## Dependencies

| Dependency | Type | Mô tả |
|-----------|------|-------|
| Supabase PostgreSQL | External | Schema `customer` — cores, outbox |
| Upstash Redis | External | Cache-Aside cho customer queries |
| GCP Pub/Sub Emulator | External | Publish events: customer.created, customer.updated |
| Sales Service | Internal (inbound) | HTTP credit-check endpoint |

## Configuration

| Env Var | Required | Mô tả |
|---------|:--------:|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | ✅ | Redis cache URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Redis cache token |
| `PUBSUB_EMULATOR_HOST` | ✅ | Pub/Sub Emulator host |

## Key Resources

- **API Reference**: [customer-endpoints.md](../api/customer-endpoints.md)
- **Bounded Context**: [bounded-contexts.md §3.2](../architecture/bounded-contexts.md)
- **Data Model**: [data-model.md §3](../architecture/data-model.md)
- **Events**: [event-flows.md §3.2](../architecture/event-flows.md)
- **Design Patterns**: [design-patterns.md §1-5, §13](../architecture/design-patterns.md)
- **Business Requirements**: [business-requirements.md §3.1](../overview/business-requirements.md)
- **Implementation Status**: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md)

## Related Concepts

- [Sales Service](./sales-service.md) — calls HTTP credit-check
- [Auth Service](./auth-service.md) — JWT protection
