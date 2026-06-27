# Changelog

Nhật ký thay đổi của knowledge bundle này.

## 2026-06-27

- Deleted: `docs/README.md` — trùng vai trò với `index.md`, nội dung merge vào Root README
- Updated: [Root README](../README.md) — merge "Hướng dẫn đọc" + "Tìm theo nhu cầu" từ docs/README, cập nhật Quick Start dùng `install:all`/`dev:all`
- Updated: [Getting Started](./development/getting-started.md) — rewrite: Docker chỉ cho Pub/Sub, backend chạy terminal với `dev:all`, cập nhật 6 services + ports
- Added: [Catalog Service API](./api/catalog-endpoints.md) — API Endpoint reference cho Catalog `:3005`
- Added: [Purchasing Service API](./api/purchasing-endpoints.md) — API Endpoint reference cho Purchasing `:3006`
- Added: [services/](./services/index.md) — 7 System Component quick reference files
- Added: [services/auth-service.md](./services/auth-service.md) — Auth Service quick reference
- Added: [services/customer-service.md](./services/customer-service.md) — Customer Service quick reference
- Added: [services/sales-service.md](./services/sales-service.md) — Sales Service quick reference
- Added: [services/inventory-service.md](./services/inventory-service.md) — Inventory Service quick reference
- Added: [services/catalog-service.md](./services/catalog-service.md) — Catalog Service quick reference
- Added: [services/purchasing-service.md](./services/purchasing-service.md) — Purchasing Service quick reference
- Added: [services/api-gateway.md](./services/api-gateway.md) — API Gateway quick reference
- Added: [archive/](./archive/index.md) — thư mục lưu trữ tài liệu đã hoàn thành
- Updated: [Root README](../README.md) — reflect current implementation status (all services ✅)
- Updated: [Project Goals](./overview/project-goals.md) — 6 contexts, scope update, all 11 patterns ✅
- Updated: [Bounded Contexts](./architecture/bounded-contexts.md) — thêm §3.5 Catalog, §3.6 Purchasing
- Updated: [System Overview](./architecture/system-overview.md) — slim down ~560→~290 dòng, thay duplicate bằng links
- Updated: [Event Flows](./architecture/event-flows.md) — xóa §5 Outbox detail trùng lặp, thay bằng link
- Updated: [Business Requirements](./overview/business-requirements.md) — thêm §3.5 Catalog, §3.6 Purchasing user stories
- Updated: [API index](./api/index.md) — thêm Catalog + Purchasing entries
- Updated: [docs/index.md](./index.md) — thêm services/, archive/, xóa archived entries
- Updated: `docs/README.md` (deleted 2026-06-27) — thêm services link, Catalog/Purchasing API, archive link, xóa tree
- Archived: [Upgrade Plan](./archive/upgrade-plan.md) — Phase 0-5 completed, moved to archive/
- Archived: [Domain Gap Analysis](./archive/domain-gap-analysis.md) — Phase 0-4 completed, moved to archive/
- Deleted: development/study-guide/ — empty directory removed

## 2026-06-26


- Updated: [Implementation Status](./IMPLEMENTATION-STATUS.md) — thêm OKF frontmatter (Reference)
- Updated: [Technical Review](./technical-review.md) — thêm OKF frontmatter (Technical Review)
- Updated: [Domain Gap Analysis](./domain-gap-analysis.md) — thêm OKF frontmatter (Technical Review)
- Updated: [E2E Test Plan](./e2e-test-plan.md) — thêm OKF frontmatter (Runbook)
- Updated: [System Flows](./flows.md) — thêm OKF frontmatter (Reference)
- Updated: [Upgrade Plan](./upgrade-plan.md) — thêm OKF frontmatter (Runbook)
- Updated: [Project Goals](./overview/project-goals.md) — thêm OKF frontmatter (System Component)
- Updated: [Business Requirements](./overview/business-requirements.md) — thêm OKF frontmatter (Business Rule)
- Updated: [Tech Decisions](./overview/tech-decisions.md) — thêm OKF frontmatter (Architecture Decision)
- Updated: [Glossary](./overview/glossary.md) — thêm OKF frontmatter (Reference)
- Updated: [System Overview](./architecture/system-overview.md) — thêm OKF frontmatter (System Component)
- Updated: [Bounded Contexts](./architecture/bounded-contexts.md) — thêm OKF frontmatter (System Component)
- Updated: [Data Model](./architecture/data-model.md) — thêm OKF frontmatter (Database Schema)
- Updated: [Event Flows](./architecture/event-flows.md) — thêm OKF frontmatter (System Component)
- Updated: [Design Patterns](./architecture/design-patterns.md) — thêm OKF frontmatter (Reference)
- Updated: [RBAC](./architecture/rbac.md) — thêm OKF frontmatter (System Component)
- Updated: [Auth Service API](./api/auth-endpoints.md) — thêm OKF frontmatter (API Endpoint)
- Updated: [Customer Service API](./api/customer-endpoints.md) — thêm OKF frontmatter (API Endpoint)
- Updated: [Order Service API](./api/order-endpoints.md) — thêm OKF frontmatter (API Endpoint)
- Updated: [Inventory Service API](./api/inventory-endpoints.md) — thêm OKF frontmatter (API Endpoint)
- Updated: [Getting Started](./development/getting-started.md) — thêm OKF frontmatter (Runbook)
- Updated: [Coding Standards](./development/coding-standards.md) — thêm OKF frontmatter (Reference)
- Added: [docs/index.md](./index.md) — OKF root directory listing
- Added: [overview/index.md](./overview/index.md) — OKF overview directory listing
- Added: [architecture/index.md](./architecture/index.md) — OKF architecture directory listing
- Added: [api/index.md](./api/index.md) — OKF API directory listing
- Added: [development/index.md](./development/index.md) — OKF development directory listing
