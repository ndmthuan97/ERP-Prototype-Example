# Services

Quick reference cho từng service trong hệ thống ERP Prototype. Mỗi file tập trung links tới tất cả docs liên quan đến service đó.

## Concepts

| Concept | Type | Resource | Mô tả |
|---------|------|----------|-------|
| [Auth Service](./auth-service.md) | System Component | `:3004` | JWT authentication, RBAC 3 roles |
| [Customer Service](./customer-service.md) | System Component | `:3001` | Customer B2B CRUD, credit check, Value Object |
| [Sales Service](./sales-service.md) | System Component | `:3002` | Order lifecycle, Saga, Delivery, Return, CQRS |
| [Inventory Service](./inventory-service.md) | System Component | `:3003` | Stock management, Optimistic Locking, reserve/release |
| [Catalog Service](./catalog-service.md) | System Component | `:3005` | Product CRUD, taxRate, SKU validation |
| [Purchasing Service](./purchasing-service.md) | System Component | `:3006` | PO lifecycle, Supplier, goods receipt |
| [API Gateway](./api-gateway.md) | System Component | `:3010` | JWT verify, proxy routing, rate limiting, Helmet |
