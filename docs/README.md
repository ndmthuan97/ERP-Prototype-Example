# 📚 Tài liệu dự án — ERP Prototype

> Bản đồ tài liệu cho dự án ERP Prototype.
> Đọc theo thứ tự từ trên xuống để hiểu toàn bộ hệ thống.

---

## Hướng dẫn đọc

| Bước | Đọc gì | Mục đích |
|:---:|---|---|
| 1 | [Project Goals](overview/project-goals.md) | Hiểu mục tiêu, scope |
| 2 | [Business Requirements](overview/business-requirements.md) | Hiểu nghiệp vụ, user stories |
| 3 | [Glossary](overview/glossary.md) | Nắm thuật ngữ |
| 4 | [Tech Decisions](overview/tech-decisions.md) | Tại sao chọn từng công nghệ |
| 5 | [System Overview](architecture/system-overview.md) | Sơ đồ tổng thể, tech stack, `@erp/shared` |
| 6 | [Bounded Contexts](architecture/bounded-contexts.md) | 3 contexts, data ownership |
| 7 | [Data Model](architecture/data-model.md) | ER diagrams, table definitions |
| 8 | [Event Flows](architecture/event-flows.md) | Pub/Sub topics, saga flow |
| 9 | [Design Patterns](architecture/design-patterns.md) | 14 patterns giải thích |
| 10 | [RBAC](architecture/rbac.md) | 3 roles, permission matrix |
| 11 | [API Reference](api/) | Endpoints cho từng service |
| 12 | [Getting Started](development/getting-started.md) | Setup + chạy lần đầu |
| 13 | [Coding Standards](development/coding-standards.md) | Quy tắc code, tích hợp `@erp/shared` |

---

## Tìm theo nhu cầu

| Tôi muốn... | Đọc |
|---|---|
| Hiểu dự án này làm gì | [Project Goals](overview/project-goals.md) |
| Setup chạy local | [Getting Started](development/getting-started.md) |
| Xem API endpoints | [Auth](api/auth-endpoints.md) · [Customer](api/customer-endpoints.md) · [Order](api/order-endpoints.md) · [Inventory](api/inventory-endpoints.md) |
| Hiểu kiến trúc | [System Overview](architecture/system-overview.md) |
| Hiểu Saga flow | [Event Flows](architecture/event-flows.md) |
| Hiểu database schema | [Data Model](architecture/data-model.md) |
| Biết quy tắc phân quyền | [RBAC](architecture/rbac.md) |
| Hiểu tại sao chọn NestJS, Prisma... | [Tech Decisions](overview/tech-decisions.md) |
| Hiểu `@erp/shared` package | [System Overview → §11](architecture/system-overview.md) · [Design Patterns → §12–14](architecture/design-patterns.md) · [Coding Standards → §8–9](development/coding-standards.md) |
| Học từng service chi tiết | [Study Guide](development/study-guide/) (viết sau khi code xong) |

---

## Cấu trúc docs/

```
docs/
├── README.md                    ← Bạn đang ở đây
├── overview/
│   ├── project-goals.md         Mục tiêu, scope, success criteria
│   ├── business-requirements.md User stories, business context
│   ├── tech-decisions.md        ADR — tại sao chọn từng tech
│   └── glossary.md              Thuật ngữ DDD, CQRS, Saga...
├── architecture/
│   ├── system-overview.md       Sơ đồ tổng thể, tech stack
│   ├── bounded-contexts.md      3 contexts, interaction rules
│   ├── data-model.md            ER diagrams, table definitions
│   ├── event-flows.md           Pub/Sub topics, saga flow
│   ├── design-patterns.md       11 patterns áp dụng
│   └── rbac.md                  3 roles, permission matrix
├── api/
│   ├── auth-endpoints.md        Auth: login, register, refresh
│   ├── customer-endpoints.md    Customer CRUD + credit check
│   ├── order-endpoints.md       Order lifecycle + saga
│   └── inventory-endpoints.md   Items, stock, movements
└── development/
    ├── getting-started.md       Setup guide
    ├── coding-standards.md      Quy tắc code
    └── study-guide/             (Viết sau khi code xong)
```
