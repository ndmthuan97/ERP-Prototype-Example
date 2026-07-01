---
type: Runbook
title: "Frontend Fix & UI Revamp Plan"
description: "Plan sửa 2 lỗi tích hợp (FE gọi sai URL gateway + Swagger Try-it-out ở gateway /docs), setup Database (Cloud SQL migrate + seed bootstrap users admin/manager/staff), và re-theme UI (giữ Tailwind + AntD) theo Fluent 2 / Dynamics 365, pilot trang Catalog"
tags: [plan, frontend, api-gateway, swagger, database, cloud-sql, prisma-migrate, seed, ui, ant-design, tailwind, fluent-2, dynamics-365]
timestamp: "2026-07-01T09:00:00+07:00"
diataxis: how-to
---

# Frontend Fix & UI Revamp Plan

> [!NOTE]
> Đây là **living plan** — user sẽ bổ sung thêm issue. Mỗi issue mới thêm 1 mục trong Part 1 (bug) hoặc Part 2 (UI) và cập nhật [Action Items](#action-items).

## Overview

Ba nhóm việc. **Part 3 (Database) là blocker** — môi trường hiện không chạy được cho tới khi có bảng + user, nên làm sớm (song song Part 1):

| Part | Nội dung | Priority | Trạng thái |
|---|---|---|---|
| **Part 1** | Bug tích hợp: (1B) FE gọi sai URL gateway · (1C) Swagger Try-it-out ở gateway `/docs` gọi sai path | 🔴 CRITICAL | 📝 Chờ duyệt |
| **Part 2** | Re-theme UI theo Fluent 2 / Dynamics 365 — **giữ Tailwind + AntD**, pilot trang Catalog | 🟡 MEDIUM | 📝 Chờ duyệt |
| **Part 3** | Database: migrate tạo bảng lên Cloud SQL + seed bootstrap users (admin/manager/staff) — **DB đang RỖNG, backend đang lỗi runtime** | 🔴 CRITICAL (blocker) | 📝 Chờ duyệt |

### Quyết định đã chốt (user)

- **Swagger lỗi ở** = **gateway `/docs`** (aggregate UI), không phải Swagger của từng service.
- **UI approach** = **Re-theme Ant Design** (không đổi library) — **vẫn dùng Tailwind + AntD**, chỉ chỉnh theme token + layout theo tham chiếu Microsoft.
- **Scope UI** = **Pilot 1 trang trước** (trang **Catalog**), review rồi mới nhân rộng.

### Hiện trạng đã kiểm tra (2026-07-01, read-only)

Kiểm tra thật trên project `portfolio-497506` (gcloud, **không đụng code**):

- **Cloud SQL** `erp-postgres-dev`: `RUNNABLE`, **chỉ private IP `10.182.96.3`** (không public IP). Connection name `portfolio-497506:us-central1:erp-postgres-dev`. DB `erp_prototype` + user `erp_app` đã tồn tại.
- **DB đang RỖNG — chưa có bảng, chưa có data.** Bằng chứng: log `catalog-service-dev` báo Prisma `relation "catalog.outbox" does not exist` (code `42P01`, `TableDoesNotExist`); probe `POST /api/auth/login` → **HTTP 503**. ⇒ migration chưa bao giờ chạy lên Cloud SQL → xử lý ở [Part 3](#part-3--database-migrate--seed).
- **8 Cloud Run service** đã deploy (STATUS `True`) nhưng backend **lỗi runtime** do thiếu bảng (outbox worker loop lỗi, login 503).
- **URL thật (đã lấy được — dùng cho verify Part 1):**
  - Frontend: `https://frontend-dev-s3fou5y5yq-uc.a.run.app`
  - Gateway: `https://api-gateway-dev-s3fou5y5yq-uc.a.run.app`

### Cần user quyết định

- [x] ~~URL Cloud Run `frontend-dev` + `api-gateway-dev`~~ — đã lấy được (xem trên).
- [ ] **Duyệt plan** để bắt đầu.

---

## Part 1 — Bug Fixes

### 1B. FE gọi sai URL gateway

**Severity**: 🔴 Critical
**Files**: `frontend/src/lib/api/config.ts`, `frontend/src/lib/api/client.ts`, `frontend/Dockerfile`, `.github/workflows/ci-frontend.yml`

#### Root cause

`NEXT_PUBLIC_*` được **inline lúc `next build`** (build-time), không phải runtime. Chuỗi giá trị:

```
GitHub repo var  →  ci-frontend.yml --build-arg  →  Dockerfile ARG/ENV  →  next build inline
vars.NEXT_PUBLIC_API_GATEWAY   NEXT_PUBLIC_API_GATEWAY   process.env.NEXT_PUBLIC_API_GATEWAY
```

Tại `config.ts:8`:

```ts
export const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY ?? 'http://localhost:3010';
```

`??` chỉ thay khi `null`/`undefined` — **KHÔNG thay chuỗi rỗng `''`**. Nếu repo var `NEXT_PUBLIC_API_GATEWAY` chưa set (hoặc set rỗng), `--build-arg` truyền `''` → `process.env.NEXT_PUBLIC_API_GATEWAY === ''` → `API_GATEWAY = ''`.

Hệ quả tại `client.ts` `buildUrl('', path)`:

```ts
const root = ''.endsWith('/') ? '' : `${''}/`;   // → '/'
const url  = new URL(path.replace(/^\//, ''), '/'); // base '/' KHÔNG absolute → lỗi / rơi về origin FE
```

⇒ Request không tới gateway mà **gãy hoặc trỏ về chính origin của FE** — đúng triệu chứng "FE gọi về đường dẫn của chính nó".

> [!WARNING]
> Vì là build-time, **đổi env ở Cloud Run runtime KHÔNG có tác dụng** — phải rebuild image với build-arg đúng.

#### Fix plan (1B)

| # | Task | File | Effort |
|---|---|---|---|
| 1B-1 | Đổi `??` → `\|\|` và **throw sớm** nếu rỗng trên production (fail-fast lúc build/khởi động thay vì gọi sai âm thầm) | `config.ts` | Low |
| 1B-2 | Set **GitHub repo variable** `NEXT_PUBLIC_API_GATEWAY` = URL gateway thật (vd `https://api-gateway-dev-xxxx.run.app`) | GitHub → Settings → Variables (env `dev`) | Low |
| 1B-3 | (Tùy chọn, khuyến nghị follow-up) **Runtime config**: đọc gateway URL từ biến runtime qua `/config.js` hoặc route handler thay vì inline build-time → đổi URL không cần rebuild | `next.config`, `providers`/layout | Medium |

Trước mắt làm **1B-1 + 1B-2** (fix nhanh, đủ để prod chạy đúng). **1B-3** để follow-up.

> [!NOTE]
> `client.ts` `buildUrl` cũng nên **hardening**: nếu `base` rỗng thì throw error rõ ràng thay vì tạo URL sai. Gộp vào 1B-1.

---

### 1C. Swagger Try-it-out ở gateway `/docs` gọi sai path

**Severity**: 🔴 Critical
**Files**: `backend/api-gateway/src/main.ts` (`createDocsProxy`, `swaggerConfig`), `backend/catalog-service/src/main.ts`

#### Root cause

Gateway `/docs` là **aggregate**: dropdown (`swaggerOptions.urls`) trỏ tới `/docs/<service>-json`, mỗi cái **proxy nguyên spec gốc** của service qua `createDocsProxy` (`pathRewrite → '/docs-json'`).

Spec gốc của Catalog (`catalog-service/src/main.ts`):
- `app.setGlobalPrefix('v1')` + controller `catalog` ⇒ path trong spec là **`/v1/catalog/...`**.
- `DocumentBuilder()...addBearerAuth()` — **KHÔNG có `.addServer(...)`** ⇒ spec không khai báo `servers`.

Swagger UI khi spec không có `servers` → mặc định `server = '/'` (origin trang docs = **gateway**). Bấm **Try it out** ⇒ gọi:

```
<gateway-origin>/v1/catalog/products     ← path lấy từ spec gốc
```

Nhưng gateway CHỈ route `/api/catalog/*` (rewrite `/api/catalog` → `/v1/catalog`, xem `main.ts:397-400`). Gateway **không có** route `/v1/catalog` ⇒ **404**. Đây là "gọi về đường dẫn của chính nó (gateway origin) nhưng sai path, thay vì route `/api/...` đúng".

Bảng ánh xạ đúng (public path qua gateway):

| Service | Path trong spec gốc | Path public đúng (gateway) |
|---|---|---|
| auth | `/v1/auth/*` | `/api/auth/*` |
| customers | `/v1/customers/*` | `/api/customers/*` |
| orders | `/v1/orders/*` | `/api/orders/*` |
| inventory | `/v1/inventory/*` | `/api/inventory/*` |
| catalog | `/v1/catalog/*` | `/api/catalog/*` |
| purchasing | `/v1/purchasing/*` | `/api/purchasing/*` |
| suppliers | `/v1/suppliers/*` | `/api/suppliers/*` (cùng purchasing service) |

#### Fix plan (1C)

**Option A — Transform spec trong `createDocsProxy` (khuyến nghị).**
Trong gateway, khi proxy `/docs/<service>-json`, **chỉnh response JSON** trước khi trả về UI:
1. Rewrite key `paths`: `/v1/<svc>` → `/api/<alias>` (theo bảng trên; purchasing map cả `/v1/purchasing`→`/api/purchasing` và `/v1/suppliers`→`/api/suppliers`).
2. Set `servers: [{ url: '/' }]` (gateway origin, same-origin với trang docs) để Try-it-out gọi `<gateway>/api/<alias>/...` đúng.

- Dùng `responseInterceptor` của `http-proxy-middleware` để buffer + JSON.parse + transform + trả lại. Thêm map `docsPrefix` cho từng docs-proxy (đang có sẵn `target`, bổ sung `{ from: '/v1/catalog', to: '/api/catalog' }`).
- Ưu điểm: sửa **1 chỗ ở gateway**, không đụng từng service; spec luôn khớp path public.

**Option B — Mỗi service tự `.addServer('/api/<alias>')` + đổi controller path.** Loại: phải sửa 6 service, path vẫn lệch `/v1` vs `/api`, không gọn.

⇒ **Chọn Option A.**

| # | Task | File | Effort |
|---|---|---|---|
| 1C-1 | Thêm response-interceptor rewrite `paths` `/v1/<svc>`→`/api/<alias>` + set `servers:[{url:'/'}]` trong `createDocsProxy` | `api-gateway/src/main.ts` | Medium |
| 1C-2 | Map alias cho từng docs-proxy (auth/customers/orders/inventory/catalog/purchasing + suppliers) | `api-gateway/src/main.ts` | Low |
| 1C-3 | Verify bằng Playwright: mở gateway `/docs` → chọn Catalog → Try-it-out `GET products` → request tới `<gateway>/api/catalog/products` (200) | — | Low |

> [!NOTE]
> Spec gốc của service dùng `addBearerAuth` với tên security scheme khác nhau; sau khi rewrite path, "Authorize" trên aggregate vẫn dùng token của gateway (Bearer JWT). Kiểm tra security scheme name khi transform để nút Authorize hoạt động.

---

## Part 2 — UI Revamp (giữ Tailwind + AntD)

> [!IMPORTANT]
> **Ràng buộc tuyệt đối (user):** KHÔNG đổi library. **Vẫn dùng Tailwind + Ant Design**. Chỉ re-theme (token + layout + component style) để trông giống UI enterprise của Microsoft.

### Design reference

Tham chiếu **Microsoft Fluent 2 Design System** + **Dynamics 365** (ERP của Microsoft):

| Yếu tố | Hiện tại (AntD default) | Mục tiêu (Fluent 2 / D365) |
|---|---|---|
| `colorPrimary` | `#1677ff` | **`#0F6CBD`** (Fluent brand) |
| `borderRadius` | `8` | **`4`** (Fluent dùng bo góc nhỏ) |
| `fontFamily` | Inter | **Segoe UI** (fallback Inter/system) |
| Shell nav | Sider menu đơn giản | **Site-map** style của D365 (nhóm mục, icon nhất quán) |
| Actions | Button rải rác | **CommandBar** (thanh lệnh trên cùng nội dung) |
| Table | headerBg `#fafafa` | Grid gọn kiểu D365 (row hover, density cao) |

### 2A. Theme tokens — `frontend/src/app/providers.tsx`

Chỉ đổi trong `ConfigProvider theme` (đã có sẵn block token + components):
- `token`: `colorPrimary: '#0F6CBD'`, `borderRadius: 4`, `fontFamily: "'Segoe UI', 'Inter', -apple-system, ...'"`.
- `components`: chỉnh `Card`, `Table`, `Button`, `Menu`, `Layout` theo density Fluent.

### 2B. App shell — `frontend/src/components/AppShell.tsx`

- Sider: nhóm menu theo site-map D365, icon Fluent-like, active state theo `colorPrimary`.
- Header: giữ breadcrumb + user dropdown; thêm chỗ cho **CommandBar** ở Content.
- **Tailwind** dùng cho spacing/layout tiện ích; **AntD** cho component.

### 2C. Pilot — trang Catalog

- Files: `frontend/src/app/catalog/page.tsx` (list) + `frontend/src/app/catalog/[id]/page.tsx` (detail).
- Áp: CommandBar (New / Refresh / Edit), Table density D365, Detail dạng `Descriptions` gọn theo Fluent.
- **Review pilot** → chốt pattern → nhân rộng các trang khác (Customers, Orders, Inventory, Purchasing) ở đợt sau.

### Ràng buộc kỹ thuật

- Không thêm `@fluentui/react-*` (đã loại do xung đột Next 15 / React 19).
- Mọi thay đổi qua **AntD ConfigProvider token** + **Tailwind class**, không viết CSS override tràn lan.

---

## Part 3 — Database: Migrate & Seed

> [!WARNING]
> **Blocker.** DB `erp_prototype` đang **rỗng (chưa có bảng)** — đã xác nhận ở [Hiện trạng đã kiểm tra](#hiện-trạng-đã-kiểm-tra-2026-07-01-read-only). Backend deploy rồi nhưng lỗi runtime. Phải làm Part 3 thì môi trường mới chạy được.

### Nguyên nhân

Không có bước migrate/seed ở bất kỳ đâu trong repo:
- [Dockerfile](../backend/Dockerfile) chỉ chạy `prisma generate` (sinh client), **không** `migrate deploy`/`db push`.
- CI/CD ([ci-backend.yml](../.github/workflows/ci-backend.yml)) chỉ `build → push → gcloud run deploy`, **không** có bước migrate; không có Cloud Run Job migrate; không migrate-on-boot.
- **Không có seed script** (`prisma db seed`/`seed.ts`) trong repo.
- Migration file chỉ có ở **customer** + **inventory** (`prisma/migrations/`); catalog/sales/auth/purchasing chỉ có `schema.prisma` (vốn dùng `prisma db push` thủ công).

### Ranh giới IaC — cái gì Terraform, cái gì không

Câu hỏi "Cloud SQL Studio quản bằng Terraform không?" → **Không**: Studio là UI có sẵn trong Console, **không phải resource**, không có resource Terraform cho nó. Terraform chỉ lo phần hạ tầng bên dưới:

| Layer | Công cụ đúng | Terraform? |
|---|---|---|
| Instance / database / **Cloud SQL user** (`erp_app`) / IAM / API `sqladmin` | `google_sql_*`, `google_project_service`, IAM | ✅ Đã có trong [database module](../infra/modules/database/main.tf) |
| **Bảng** (schema/tables) | **Prisma migrate** | ❌ Không dùng Terraform |
| **Data / seed** (3 user login) | **Seed script / API** | ❌ Không dùng Terraform |

> [!NOTE]
> Có thể ép Terraform chạy SQL qua `null_resource + local-exec`, nhưng là **anti-pattern**, và ở đây bất khả thi vì runner không tới được private IP. Pipeline chuẩn: `Terraform (infra)` → `Prisma migrate (bảng)` → `seed script (data)`.

### 3A. Migrate — tạo bảng (chọn 1 cách)

Vì DB **chỉ private IP**, không nối trực tiếp từ laptop được. Ba cách:

| Cách | Mô tả | Đánh giá |
|---|---|---|
| **A1. Cloud SQL Studio + SQL** | Paste `migration.sql` (customer/inventory có sẵn); service khác generate SQL bằng `prisma migrate diff` rồi paste | Nhanh, không cần infra — hợp prototype |
| **A2. Cloud Run Job trong VPC** (chuẩn) | Image có Prisma CLI + `prisma.config.ts`, deploy Job `--vpc-connector` + secret `DIRECT_URL`, chạy `prisma migrate deploy`/`db push` từng service | Đúng chuẩn, lặp lại được, IaC-friendly |
| **A3. Tạm bật public IP** | Thêm public IP + authorized network (IP của bạn) → chạy `prisma migrate deploy`/`db push` từ laptop qua Cloud SQL Auth Proxy → tắt public IP | Nhanh 1 lần |

> [!NOTE]
> Mỗi service sở hữu **schema riêng** (multiSchema): `app_auth`, `catalog`, `customer`, `inventory`, `sales`, `purchasing`. Migrate phải chạy cho **từng service** để tạo đủ bảng.

### 3B. Seed — bootstrap users (admin/manager/staff)

3 user đăng nhập = **application user** (KHÔNG phải Cloud SQL user), là row trong bảng **`app_auth.users`** của auth-service, password lưu **bcrypt hash (12 salt rounds)** — xem [schema](../backend/auth-service/prisma/schema.prisma) (`email`, `passwordHash`, `fullName`, `role`).

| email | password (plain) | role | fullName (gợi ý) |
|---|---|---|---|
| admin@gmail.com | `Admin@123` | `admin` | Admin User |
| manager@gmail.com | `Manager@123` | `manager` | Manager User |
| staff@gmail.com | `Staff@123` | `staff` | Staff User |

**Cách seed:**
- `POST /api/auth/register` bcrypt-hash tự động, **nhưng** endpoint là "admin tạo user" → cần admin JWT trước ⇒ **con gà–quả trứng** với admin đầu tiên.
- ⇒ **Khuyến nghị:** viết **seed script** (Prisma + `bcryptjs` 12 rounds) tạo cả 3 user cùng lúc — chạy 1 lần qua cùng đường A2/A3. Hoặc: seed admin đầu tiên bằng script/SQL (hash tính sẵn) rồi tạo manager/staff qua API.
- **KHÔNG INSERT plaintext** — login dùng `bcrypt.compare`, plaintext sẽ fail.

> [!WARNING]
> Password policy: kiểm tra `registerSchema` ([auth.dto](../backend/auth-service/src/application/dtos/auth.dto.ts)) xem `Admin@123` (9 ký tự, có hoa/thường/số/ký tự đặc biệt) có pass validation không trước khi seed.

### 3C. Xem data trên UI Google Cloud

Cloud SQL **không có data-browser** mặc định. Xem qua **Cloud SQL Studio**:
1. Console → **SQL** → instance `erp-postgres-dev` → menu trái **Cloud SQL Studio**.
2. Đăng nhập: Database `erp_prototype` · User `erp_app` · Password (từ [terraform.tfvars](../infra/environments/dev/terraform.tfvars) `db_password` hoặc Secret Manager).
3. Query (bảng nằm trong **schema riêng**, không phải `public`):
   ```sql
   -- Kiểm tra đã có bảng chưa (hiện = 0 dòng):
   SELECT table_schema, table_name FROM information_schema.tables
   WHERE table_schema NOT IN ('pg_catalog','information_schema');
   -- Sau khi seed, xem user:
   SELECT email, role, is_active FROM app_auth.users;
   ```
- Không dùng được: `gcloud sql connect` / psql / DBeaver trực tiếp (không có public IP).
- Xem lỗi runtime: Console → **Logging → Logs Explorer** → `resource.type="Cloud Run Revision"`, service = `catalog-service-dev`.

### Fix plan (Part 3)

| # | Task | Cách | Effort |
|---|---|---|---|
| 3-1 | Migrate tạo bảng đủ 6 schema lên Cloud SQL | A1 / A2 / A3 (chốt 1) | Medium |
| 3-2 | Viết seed script tạo 3 bootstrap user (bcrypt 12 rounds) | Prisma + `bcryptjs` | Low |
| 3-3 | Chạy seed → verify `SELECT ... FROM app_auth.users` = 3 dòng | Studio / job | Low |
| 3-4 | Verify login: `POST /api/auth/login` với `admin@gmail.com` → **200 + JWT** (hết 503) | curl / Playwright | Low |
| 3-5 | (Tùy) seed data demo (products/customers/orders) qua API để UI có dữ liệu | script gọi gateway | Medium |

---

## Execution Order

1. **Part 3 (3-1 → 3-4)** — migrate tạo bảng → seed 3 bootstrap user → verify login 200. **Blocker, làm trước** (môi trường mới chạy được).
2. **1B-1 + 1B-2** — fix FE URL (config hardening + set repo var) → rebuild frontend image.
3. **1C-1 → 1C-3** — fix + verify Swagger aggregate Try-it-out (Playwright).
4. **Verify Part 1 live** trên Cloud Run (URL đã có).
5. **Part 2**: 2A → 2B → 2C (pilot Catalog) → review.
6. (Follow-up) **3-5** seed data demo; **1B-3** runtime config; nhân rộng UI các trang còn lại.

> [!NOTE]
> Part 3 là blocker (làm đầu tiên). Part 2 (2A/2B/2C) **không cần URL deploy**, có thể chạy song song Part 1/Part 3 nếu user đồng ý.

---

## Action Items

### Part 3 — Database (blocker, làm trước)

- [ ] 3-1: Migrate tạo bảng đủ 6 schema (`app_auth`/`catalog`/`customer`/`inventory`/`sales`/`purchasing`) lên Cloud SQL — chốt cách A1/A2/A3
- [ ] 3-2: Viết seed script 3 bootstrap user (bcrypt 12 rounds): admin/manager/staff@gmail.com
- [ ] 3-3: Chạy seed → verify `SELECT email, role FROM app_auth.users` = 3 dòng
- [ ] 3-4: Verify `POST /api/auth/login` (admin@gmail.com) → 200 + JWT (hết 503)
- [ ] 3-5: (tùy) seed data demo products/customers/orders qua API

### Part 1 — Bug Fixes

- [ ] 1B-1: `config.ts` `??`→`||` + throw nếu rỗng trên prod; `client.ts buildUrl` guard base rỗng
- [ ] 1B-2: Set GitHub repo var `NEXT_PUBLIC_API_GATEWAY` = URL gateway thật (env `dev`)
- [ ] 1B-3: (follow-up) Runtime config cho gateway URL
- [ ] 1C-1: Response-interceptor rewrite `paths` `/v1`→`/api` + `servers:[{url:'/'}]` trong `createDocsProxy`
- [ ] 1C-2: Map alias từng docs-proxy (auth/customers/orders/inventory/catalog/purchasing/suppliers)
- [ ] 1C-3: Playwright verify gateway `/docs` → Catalog → Try-it-out → `<gateway>/api/catalog/products` 200

### Part 2 — UI Revamp

- [ ] 2A: Theme token Fluent 2 trong `providers.tsx` (`#0F6CBD`, radius 4, Segoe UI)
- [ ] 2B: AppShell theo site-map D365 + chỗ cho CommandBar
- [ ] 2C: Pilot trang Catalog (list + detail) với CommandBar + Table/Detail density D365
- [ ] Review pilot → chốt pattern → nhân rộng

### Pending inputs (user)

- [x] ~~URL Cloud Run `frontend-dev` + `api-gateway-dev`~~ — đã lấy được (xem Hiện trạng)
- [ ] Chốt cách migrate (A1 Studio SQL / A2 Cloud Run Job / A3 tạm public IP)
- [ ] Duyệt plan để bắt đầu

---

## Related Concepts

- [Frontend Improvement Plan](./frontend-improvement-plan.md) — 38 tasks FE đã hoàn thành (4 phase)
- [API Gateway](./services/api-gateway.md) — routing `/api/*`, aggregate Swagger `/docs`
- [Catalog Service](./services/catalog-service.md) — service pilot cho UI revamp
- [CI/CD Pipeline](./architecture/cicd-pipeline.md) — build-arg `NEXT_PUBLIC_API_GATEWAY`, GitHub Environments/Variables
- [Business Requirements](./overview/business-requirements.md) — RBAC matrix (admin/manager/staff), user stories
- [GCP Cloud Architecture](./architecture/gcp-cloud-architecture.md) — Cloud SQL (private IP), VPC, Secret Manager
- [Auth Service](./services/auth-service.md) — bảng `app_auth.users`, bcrypt, roles (Part 3 seed)
- [Getting Started](./development/getting-started.md) — Prisma migrate/`db push`, `DIRECT_URL`
