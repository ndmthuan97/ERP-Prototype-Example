# Changelog

Nhật ký thay đổi của knowledge bundle này.

## 2026-07-10

- **Dọn tàn dư password auth (post-B1)**: bỏ hẳn cột `password_hash` — B1 đã chuyển sang Google sign-in, cột chỉ còn là NULL vô dụng và gây hiểu nhầm "còn login password".
  - Gỡ `passwordHash` khỏi 7 file (`schema.prisma`, `user.entity.ts`, `user.repository.impl.ts`, `register.command.ts`, `seed.ts`, 2 test) → `prisma generate` → typecheck + 21 unit test pass → `ALTER TABLE app_auth.users DROP COLUMN password_hash`.
  - `seed.ts`: bỏ 3 user demo giả (`admin@`/`manager@`/`staff@gmail.com`) khỏi `USERS_TO_SEED` — không phải Google account thật, không đăng nhập được dưới B1; allowlist admin nay chỉ qua `SEED_ADMIN_EMAIL`.
  - [data-model.md](./architecture/data-model.md) — bỏ dòng `password_hash` khỏi ERD + bảng chi tiết + note B1 (từ "giữ cột, không drop" → "drop hẳn 2026-07-10").
- **Hồi sinh E2E harness theo B1** (cả bộ đã chết từ B1: `global-setup.ts` login password → 9 suite đọc token chung, `/auth/login` bị xóa → chết ngay từ setup):
  - `global-setup.ts` — thay password login bằng exchange `E2E_ID_TOKEN` (Firebase ID token) qua `POST /auth/sso/callback` → app token + session thật.
  - `helpers/api.ts` — gỡ `login()`/`refresh()` (gọi endpoint đã xóa), thêm `logout()`; interceptor không đè `Authorization` set sẵn (để lái session thứ 2). `helpers/seed.ts` + `global-setup` bỏ `refreshToken`.
  - `suites/02-auth.e2e.ts` — viết lại theo B1 (no-token→401, valid→200, `/auth/me`, **logout→revoke tức thì→401 FR-A13**); test logout mint **session riêng** (exchange lại cùng idToken) để không giết token chung của suite 03–09. `suites/01-health.e2e.ts` — khôi phục token bằng `setAccessToken` thay `login`.
  - `test/e2e/README.md` — prereqs (allowlist admin Google + `E2E_ID_TOKEN`), mục "Getting an E2E_ID_TOKEN", sửa curl health. Verify: `tsc --noEmit` cả cây e2e exit 0.

## 2026-07-08

- **B1 — Auth sang Google sign-in (Identity Platform) + session whitelist**: cập nhật docs phản ánh migration off self-rolled email/password JWT.
  - [auth-gap](./gap/prototype-vs-newdesign-auth-gap.md) — viết lại §1 theo reality sau B1, §3 Gap Summary + §4 kết luận: **FR-A13 CLOSED** (revoke tức thì qua session whitelist), **FR-A9 done** (idle timeout theo role), Identity Platform adopted; đánh dấu rõ deviation interim còn mở (Workspace domain SSO, MFA, OTP FR-A2, RBAC-as-code FR-A4/A6/A8)
  - [tech-decisions](./overview/tech-decisions.md) — thêm **ADR-015** (Google sign-in + allowlist interim + session whitelist, forward path lật allowlist → `hd` khi có Workspace domain); đánh dấu ADR-006 superseded phần login/token; cập nhật Tổng kết + Improvement pass
  - [auth-endpoints](./api/auth-endpoints.md) — thay login/refresh/logout bằng `POST /auth/sso/callback` (`{idToken}`→`{accessToken,user}`, public) + `POST /auth/logout` (204, `x-user-sid`); register password-less; overview/sequence/error-flow theo Identity Platform + session whitelist; thêm mục **Manual E2E Verification**
  - [implementation-status](./operations/implementation-status.md) — auth-service + api-gateway rows, Login page, pattern "SSO + Session Whitelist", DB `app_auth.sessions` (refresh_tokens deprecated), Recent Upgrades B1
  - [rbac](./architecture/rbac.md) — gateway session whitelist (`getex session:<sid>`) + inject `x-user-sid`, app token HS256 mang `sid`, auth qua Identity Platform; guard/flow/token-lifecycle cập nhật; **RBAC 3-role KHÔNG đổi**
  - Cập nhật [gap/index.md](./gap/index.md) + [api/index.md](./api/index.md) mô tả concept auth theo B1
  - **Manual steps còn lại (ngoài docs)**: setup GCP Identity Platform (OAuth consent/client + apiKey là bước console thủ công), chạy SQL tạo bảng `app_auth.sessions`, provision user vào allowlist (`app_auth.users`)
  - Added: [B1 — Identity Platform Setup](./operations/b1-identity-platform-setup.md) — runbook "chạy thật" (GCP Console → Terraform → DB SQL → env → allowlist → E2E revoke test + troubleshooting); thêm vào [operations/index.md](./operations/index.md)
- Restructure: tạo thư mục [operations/](./operations/index.md) gom 7 concept vận hành (`git mv` từ docs root): [Implementation Status](./operations/implementation-status.md) (rename từ `IMPLEMENTATION-STATUS.md` → kebab-case), [Known Bugs](./operations/known-bugs.md), [System Flows](./operations/flows.md), [E2E Test Plan](./operations/e2e-test-plan.md), [Run Backend with Prod Config](./operations/run-backend-with-prod-config.md), [CDC → Reporting Learning Plan](./operations/cdc-reporting-learning-plan.md), [UI D365 Rollout & Backlog](./operations/ui-d365-rollout-and-backlog.md). Sửa 59 cross-link (inbound ở api/architecture/services/gap/archive/learning/log + outbound rebase của 2 file moved), tạo [operations/index.md](./operations/index.md), cập nhật root index (bỏ 7 concept, thêm subdir `operations/`), fix link trong `README.md`
- Fix type: [Project Goals](./overview/project-goals.md) `System Component` → `Reference` (tài liệu scope/vision, không phải component)

## 2026-07-07

- Added: [auth-gap](./gap/prototype-vs-newdesign-auth-gap.md) §2 — luồng hybrid target (Identity Platform + session whitelist + Redis): sequence Login/Request/Refresh/Revoke, giải thích vì sao lai, và prototype đang ở đâu trong luồng
- Restructure: gộp các doc gap vào thư mục [gap/](./gap/index.md) — `git mv` [prototype-vs-newdesign-cdc-gap.md](./gap/prototype-vs-newdesign-cdc-gap.md) + thêm mới [prototype-vs-newdesign-auth-gap.md](./gap/prototype-vs-newdesign-auth-gap.md) (auth prototype JWT stateless vs design Identity Platform + session whitelist; gap revoke tức thì FR-A13). Sửa link tương đối + thêm `gap/` vào index Subdirectories
- Added: [CDC → Reporting Learning Plan](./operations/cdc-reporting-learning-plan.md) — bổ sung vào index Concepts (trước đó có file nhưng chưa liệt kê)
- Cleanup: archive 2 plan FE đã xong/bị thay thế → `docs/archive/` ([Frontend Improvement Plan](./archive/frontend-improvement-plan.md) 38/38 done; [Frontend Fix & UI Revamp](./archive/frontend-fix-and-ui-revamp-plan.md) superseded by ui-d365-rollout-and-backlog). Cập nhật archive/index + root index + link ở ui-d365/log
- Cleanup: `git rm docs/ui-reference/*.png` (4 mockup D365 không được tham chiếu ở đâu; khôi phục được từ git nếu cần embed)
- Fix drift: cập nhật Tech Stack + banner "stack đã sang GCP" trong [technical-review.md](./technical-review.md) và [e2e-test-plan.md](./operations/e2e-test-plan.md) (Supabase/Docker-Compose/Pub-Sub Emulator → Cloud SQL/Cloud Run/Pub-Sub managed)
- Fix drift: viết lại phần phân tích rủi ro/CI-CD/hạ tầng của technical-review theo stack mới — mục đã giải quyết nhờ GCP đánh dấu RESOLVED (CD, Dockerfile, rollback qua Cloud Deploy, Cloud SQL backup); DevOps score 4→7, total 62→64/100; mục "free-tier connection limit" hạ HIGH→MEDIUM (Cloud SQL theo tier)
- Cleanup: reconcile các mục "đã xong nhưng vẫn liệt kê là issue" trong technical-review — rate limiting, circuit breaker, API versioning, Helmet, refresh-token rotation đánh dấu RESOLVED ở cả Recommendations/Issues/Security + rationale scorecard (verify từ code: gateway main.ts helmet/rateLimit, refresh-token.command rotate). FE #9 chỉnh thành "chưa silent-refresh chủ động" (backend đã rotate)
- Added: [Known Bugs](./operations/known-bugs.md) — file bug riêng: BUG-001 Swagger hiển thị internal headers required; BUG-002 `/metrics` bị gateway JWT chặn; BUG-003 Swagger Authorize không gửi Authorization header (thiếu `.addSecurity()`)

## 2026-07-02

- Updated: [UI D365 Rollout & BE↔FE Backlog](./operations/ui-d365-rollout-and-backlog.md) — thêm trang **RBAC Roles & Permissions** (read-only `/roles`): ma trận role × quyền render từ `lib/auth/permissions.ts` (một nguồn sự thật, `CAN` derive từ đây); backlog thêm item RBAC động (optional). Kèm fix bypass loop: cờ `AUTH_BYPASS` tách ra `lib/auth/bypass.ts`, interceptor 401 không hard-redirect khi bypass, banner "DEV BYPASS" trên header
- Added: [UI D365 Rollout & BE↔FE Backlog](./operations/ui-d365-rollout-and-backlog.md) — Runbook: trạng thái rollout UI Power Apps/D365 toàn app (top bar brand + site-map sidebar, primitive `CommandBar`/`FormSection`/`Field`, view-picker + grid + tabbed form), fix từ review (remove-line 404, honor filter customer/order, a11y keyboard), feature BE→FE mới (User Management + search server-side, `/me`, order fulfil, delivery fail, inventory issue, credit-check what-if), + backlog & deploy còn lại; verify FE build 12/12 route + 3 BE service `tsc` sạch
- Added: [Run Backend with Prod Config](./operations/run-backend-with-prod-config.md) — Runbook: chạy 6 service + gateway local trỏ prod (Cloud SQL Auth Proxy, script `dev:prod`) — bổ sung vào index (trước đó chưa liệt kê)
- Updated: [docs/index.md](./index.md) — thêm 2 entry: UI D365 Rollout & Backlog, Run Backend with Prod Config

## 2026-07-01

- Added: [Frontend Fix & UI Revamp Plan](./archive/frontend-fix-and-ui-revamp-plan.md) — Runbook: plan sửa 2 bug tích hợp (1B FE gọi sai URL do `NEXT_PUBLIC_API_GATEWAY` build-time; 1C Swagger Try-it-out ở gateway `/docs` gọi `/v1/*` thay vì `/api/*`) + Part 2 re-theme UI giữ Tailwind+AntD theo Fluent 2/Dynamics 365, pilot Catalog
- Updated: [Frontend Fix & UI Revamp Plan](./archive/frontend-fix-and-ui-revamp-plan.md) — thêm **Part 3 — Database: Migrate & Seed** (blocker): hiện trạng DB rỗng đã kiểm tra thật (`TableDoesNotExist`, login 503), ranh giới IaC (Cloud SQL Studio không quản bằng Terraform), 3 cách migrate, seed 3 bootstrap user admin/manager/staff (bcrypt), cách xem data qua Cloud SQL Studio; ghi URL Cloud Run thật đã lấy được
- Updated: [docs/index.md](./index.md) — thêm entry Frontend Fix & UI Revamp Plan

## 2026-06-30

- Added: [GCP Cloud Architecture](./architecture/gcp-cloud-architecture.md) — System Component: target infrastructure trên GCP (Cloud Run, Cloud SQL, Pub/Sub, VPC, IAM, WIF, Terraform modules, chi phí ~$15-20/month)
- Added: [CI/CD Pipeline](./architecture/cicd-pipeline.md) — System Component: GitHub Actions CI + Cloud Build CD, Workload Identity Federation, monorepo path filters, RBAC via GitHub Environments
- Added: [GCP Implementation Plan](./architecture/gcp-implementation-plan.md) — Runbook: step-by-step plan ~37 files (Terraform modules, GitHub Actions, Cloud Build, Dockerfiles)
- Updated: [architecture/index.md](./architecture/index.md) — thêm GCP Implementation Plan entry

## 2026-06-29

- Added: [learning/](./learning/index.md) — thư mục tài liệu học tập & nghiên cứu
- Added: [learning/terraform/](./learning/terraform/index.md) — Terraform Pareto 80/20 knowledge bundle (7 concepts)
- Added: [IaC & Terraform Overview](./learning/terraform/iac-and-terraform-overview.md) — Learning Note: tổng quan IaC, declarative model, vị trí trong DevOps
- Added: [Core Concepts](./learning/terraform/core-concepts.md) — Concept Explanation: Provider, Resource, State, Module, Variables/Outputs
- Added: [Core Workflow](./learning/terraform/core-workflow.md) — Concept Explanation: init → plan → apply → destroy, CI/CD integration
- Added: [HCL Syntax & Project Structure](./learning/terraform/hcl-syntax-and-structure.md) — Reference: cú pháp HCL, variable types, project structure chuẩn
- Added: [Best Practices](./learning/terraform/best-practices.md) — Learning Note: state management, security, code org, CI/CD
- Added: [Ecosystem 2025-2026](./learning/terraform/ecosystem-2025-2026.md) — Comparison: BSL license, OpenTofu, Pulumi/CloudFormation/Ansible
- Added: [Command Cheat Sheet](./learning/terraform/command-cheatsheet.md) — Reference: CLI commands tra cứu nhanh
- Updated: [docs/index.md](./index.md) — thêm learning/ subdirectory entry

## 2026-06-27

- Added: [Frontend Improvement Plan](./archive/frontend-improvement-plan.md) — Technical Review: đánh giá toàn diện FE, 38 tasks chia 4 phase (bug fixes, missing features, UX, architecture)
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


- Updated: [Implementation Status](./operations/implementation-status.md) — thêm OKF frontmatter (Reference)
- Updated: [Technical Review](./technical-review.md) — thêm OKF frontmatter (Technical Review)
- Updated: [Domain Gap Analysis](./archive/domain-gap-analysis.md) — thêm OKF frontmatter (Technical Review)
- Updated: [E2E Test Plan](./operations/e2e-test-plan.md) — thêm OKF frontmatter (Runbook)
- Updated: [System Flows](./operations/flows.md) — thêm OKF frontmatter (Reference)
- Updated: [Upgrade Plan](./archive/upgrade-plan.md) — thêm OKF frontmatter (Runbook)
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
