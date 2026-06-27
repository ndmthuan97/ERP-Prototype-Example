# API Reference

API endpoint documentation cho từng backend service. Tất cả endpoint truy cập qua API Gateway `:3010`.

## Concepts

| Concept | Type | Resource | Mô tả |
|---------|------|----------|-------|
| [Auth Service](./auth-endpoints.md) | API Endpoint | `:3004` | Login, refresh, logout, RBAC |
| [Customer Service](./customer-endpoints.md) | API Endpoint | `:3001` | Customer CRUD, credit check |
| [Order Service](./order-endpoints.md) | API Endpoint | `:3002` | SO lifecycle, Saga, Delivery, Return |
| [Inventory Service](./inventory-endpoints.md) | API Endpoint | `:3003` | Stock items, receive, reserve, release |
| [Catalog Service](./catalog-endpoints.md) | API Endpoint | `:3005` | Product CRUD, taxRate, activate/deactivate |
| [Purchasing Service](./purchasing-endpoints.md) | API Endpoint | `:3006` | PO lifecycle, Supplier CRUD, goods receipt |
