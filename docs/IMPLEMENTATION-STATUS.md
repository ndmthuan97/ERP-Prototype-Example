# Implementation Status — Cái gì đã làm, cái gì chưa

> **Đọc file này trước tiên.** Phần lớn tài liệu trong `docs/` được viết theo phương pháp _docs-first_ (blueprint trước khi code). Vì vậy nhiều doc mô tả service/endpoint **chưa tồn tại trong code**. Bảng dưới là nguồn chân lý duy nhất về trạng thái thực tế.
>
> Cập nhật lần cuối: **2026-06-19**. Khi build thêm, hãy cập nhật file này.

**Chú thích:** ✅ Đã implement · 🚧 Đang làm · ⬜ Mới là blueprint (chưa có code)

---

## Backend services

| Service | Port | Trạng thái | Ghi chú |
|---|---|:---:|---|
| `@erp/shared` (library) | — | ✅ | cache, messaging (outbox worker, pubsub, idempotency), observability (logger, metrics, health, correlation), config, contracts |
| `customer-service` | 3001 | ✅ | DDD 4 tầng, CQRS-lite, Outbox, Redis cache, /health, /metrics. Schema đã áp lên Supabase + integration test |
| `inventory-service` | 3003 | ✅ | DDD, CQRS, Outbox, **Optimistic Locking** (version + retry/backoff), REST reserve/release. Schema đã áp lên Supabase + integration test (concurrent reserve không mất update) |
| `auth-service` | 3004 | ⬜ | Chỉ là scaffold `nest new` (trả `Hello World!`). Chưa có bcrypt/JWT/RBAC/Prisma |
| `order-service` | 3002 | ⬜ | Scaffold `Hello World!`. Saga/CQRS/Aggregate Root chưa có (cần Pub/Sub consumer infra) |
| `api-gateway` | 3010 | ⬜ | Scaffold `Hello World!`. JWT verify + routing chưa có |
| `frontend` (Next.js) | 3000 | ⬜ | Thư mục **rỗng**. Chưa có code |

> **Hệ quả:** hiện chỉ `customer-service:3001` chạy được. Mọi `curl` trong docs trỏ tới gateway `:3010` hay các service khác sẽ **không hoạt động**.

---

## Patterns / capabilities

| Hạng mục | Trạng thái | Ở đâu |
|---|:---:|---|
| DDD Layers (domain/application/infrastructure/presentation) | ✅ | customer-service |
| Repository Pattern (port ở domain) | ✅ | customer-service |
| Value Object (TaxCode) | ✅ | customer-service |
| Outbox Pattern (write event trong transaction) | ✅ | customer-service + shared |
| Outbox Worker (poll → publish Pub/Sub) | ✅ (an toàn đa-instance) | shared — CLAIM bằng `FOR UPDATE SKIP LOCKED` + retry/DLQ ([ADR-009](overview/tech-decisions.md)) |
| Cache-Aside (Redis) | ✅ | customer-service + shared |
| Observability (correlationId, structured log, metrics, health live/ready) | ✅ | shared |
| Event envelope versioned + `eventId` | ✅ | `EventEnvelope` ở shared; `eventId` (id outbox) gắn vào message attributes ([ADR-010](overview/tech-decisions.md)) |
| Idempotent Consumer (`withIdempotency`) | ✅ (sẵn sàng) | helper 2-trạng thái + `eventId` đã propagate; còn chờ subscriber thật (order/inventory) để dùng |
| CQRS (read model/projection riêng) | 🚧 | mới "CQRS-lite" — command & query chung 1 repo/1 DB |
| Aggregate Root + Domain Events | 🚧 | entity có business method; chưa phát domain event chuẩn |
| Saga (orchestration order ↔ inventory ↔ customer) | ⬜ | chỉ có sequence diagram trong `event-flows.md` |
| Optimistic Locking | ✅ | inventory-service: cột `version` + `updateMany WHERE version` + retry/backoff (`withOptimisticRetry`) |
| RBAC + JWT | ⬜ | blueprint trong `rbac.md`, `auth-endpoints.md` |
| API Gateway routing | ⬜ | blueprint |
| Frontend (Next.js + AntD) | ⬜ | chưa có |

---

## Database (Supabase PostgreSQL)

| Schema | Bảng | Trạng thái |
|---|---|:---:|
| `customer` | `cores`, `outbox` | ✅ đã áp lên Supabase |
| `inventory` | `stock_items`, `outbox` | ✅ đã áp lên Supabase (optimistic locking qua `version`) |
| `order` | headers, lines, status_history, outbox... | ⬜ blueprint |
| `auth` | users, refresh_tokens... | ⬜ blueprint (lưu ý: blueprint đang đặt vào schema `auth` của Supabase — cần đổi sang `app_auth`, xem [improvement-plan.md](../improvement-plan.md) Phase 5) |

> `customer.cores`: `tax_code` **nullable + UNIQUE toàn cục** (chống trùng MST ở DB); có `deleted_at` (soft delete, có index); tiền là số nguyên đồng. `customer.outbox` có thêm cột claim/retry/DLQ (`locked_until`, `attempts`, `last_error`, `dead_lettered_at`). `data-model.md` đã đồng bộ.

---

## DevOps

| Hạng mục | Trạng thái |
|---|:---:|
| Pub/Sub Emulator (docker-compose) | ✅ |
| Setup scripts (`create-schemas.js`, `verify-connections.js`) | ✅ |
| Seed admin script | ⬜ (đã gỡ khỏi `scripts/package.json` cho tới khi auth-service được build) |
| CI/CD (lint hard gate + build + test/coverage) | ✅ (`.github/workflows/ci.yml`) |
| Dockerfile cho từng service | ⬜ |

---

## Mức độ hoàn thành theo plan

Theo [prototype-development-plan.md](../prototype-development-plan.md): đã xong **Phase 0, 1, 1.5, 2 (config), 2.5, 3**. Các Phase 4–13 (Inventory, Order, Auth+Gateway, E2E, Frontend, CDC, Study guide) **chưa bắt đầu**.

Roadmap củng cố cái đã có: xem [improvement-plan.md](../improvement-plan.md).
