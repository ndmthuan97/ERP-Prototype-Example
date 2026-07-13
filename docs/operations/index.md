# Operations

Vận hành & trạng thái dự án: source-of-truth implementation status, known bugs, luồng nghiệp vụ, kế hoạch E2E test, runbook chạy backend, backlog UI, và plan analytics pipeline.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Implementation Status](./implementation-status.md) | Reference | Source of truth cho trạng thái implement (services, pages, patterns, schemas) |
| [Known Bugs](./known-bugs.md) | Runbook | Bug đã xác nhận, chưa fix (Swagger internal headers, `/metrics` JWT, Authorize header) |
| [System Flows](./flows.md) | Reference | 9 luồng nghiệp vụ (6 chính + 3 compensation), sequence diagrams |
| [E2E Test Plan](./e2e-test-plan.md) | Runbook | Kế hoạch E2E test (9 suites, ~80+ tests) qua API Gateway |
| [Run Backend with Prod Config](./run-backend-with-prod-config.md) | Runbook | Chạy 6 service + gateway ở local trỏ tài nguyên PROD (Cloud SQL Auth Proxy + `dev:prod`) |
| [B1 — Identity Platform Setup](./b1-identity-platform-setup.md) | Runbook | Chạy thật B1 (Google sign-in + session whitelist): GCP Console, Terraform, DB SQL, env, allowlist, E2E revoke test |
| [UI D365 Rollout & BE↔FE Backlog](./ui-d365-rollout-and-backlog.md) | Runbook | Trạng thái rollout UI D365 toàn app + backlog & deploy còn lại (nguồn FE status duy nhất) |
| [CDC → Reporting Learning Plan](./cdc-reporting-learning-plan.md) | Runbook | Kế hoạch thin-slice analytics pipeline (Cloud SQL → Datastream → BigQuery → dbt → Looker) |
