# ERP Prototype Documentation

Tài liệu kỹ thuật cho dự án ERP Prototype — microservices architecture learning project.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Implementation Status](./IMPLEMENTATION-STATUS.md) | Reference | Source of truth cho trạng thái implement |
| [Technical Review](./technical-review.md) | Technical Review | Đánh giá kỹ thuật toàn diện |
| [E2E Test Plan](./e2e-test-plan.md) | Runbook | Kế hoạch E2E test (9 suites, ~80+ tests) |
| [System Flows](./flows.md) | Reference | 9 luồng nghiệp vụ chính (sequence diagrams) |
| [Frontend Improvement Plan](./frontend-improvement-plan.md) | Technical Review | Đánh giá FE — 38 tasks chia 4 phase: bug fixes, features, UX, architecture |
| [Frontend Fix & UI Revamp Plan](./frontend-fix-and-ui-revamp-plan.md) | Runbook | Plan: sửa FE gọi sai URL + Swagger gateway `/docs`, setup Database (Cloud SQL migrate + seed users), re-theme UI (Tailwind+AntD theo Fluent 2/D365, pilot Catalog) |

## Subdirectories

| Directory | Mô tả |
|-----------|-------|
| [overview/](./overview/index.md) | Mục tiêu, nghiệp vụ, tech decisions, glossary |
| [architecture/](./architecture/index.md) | Kiến trúc hệ thống, data model, patterns |
| [api/](./api/index.md) | API endpoint reference cho từng service |
| [services/](./services/index.md) | Quick reference per service (port, schema, dependencies, links) |
| [development/](./development/index.md) | Setup guide, coding standards |
| [archive/](./archive/index.md) | Tài liệu đã hoàn thành (lịch sử) |
| [learning/](./learning/index.md) | Tài liệu học tập & nghiên cứu (Terraform, ...) |

