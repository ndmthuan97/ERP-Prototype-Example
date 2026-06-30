# Architecture

Kiến trúc hệ thống ERP Prototype: service map, bounded contexts, data model, event flows, design patterns, RBAC.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [System Overview](./system-overview.md) | System Component | Sơ đồ tổng thể, tech stack, DDD layers |
| [Bounded Contexts](./bounded-contexts.md) | System Component | 6 contexts, context map, interaction rules |
| [Data Model](./data-model.md) | Database Schema | ER diagrams, table definitions, constraints |
| [Event Flows](./event-flows.md) | System Component | Pub/Sub topics, Outbox, Saga choreography |
| [Design Patterns](./design-patterns.md) | Reference | 14+ patterns giải thích chi tiết |
| [RBAC](./rbac.md) | System Component | 3 roles, permission matrix, JWT guard |
| [GCP Cloud Architecture](./gcp-cloud-architecture.md) | System Component | Target infrastructure trên GCP: Cloud Run, Cloud SQL, Pub/Sub, VPC, IAM |
| [CI/CD Pipeline](./cicd-pipeline.md) | System Component | GitHub Actions CI + Cloud Build CD, WIF, monorepo path filters |
| [GCP Implementation Plan](./gcp-implementation-plan.md) | Runbook | Step-by-step plan: ~37 files Terraform + GitHub Actions + Cloud Build |
