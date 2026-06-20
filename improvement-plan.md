# Improvement Plan — ERP Prototype

> Kế hoạch cải thiện dựa trên Technical Review Board (2026-06-19).
> Phụ trợ cho [prototype-development-plan.md](./prototype-development-plan.md) — file đó là roadmap **xây mới**; file này là roadmap **củng cố cái đã có + sửa docs**.
>
> Trạng thái thực tế (xem [docs/IMPLEMENTATION-STATUS.md](./docs/IMPLEMENTATION-STATUS.md)): chỉ `customer-service` + `@erp/shared` đã implement. `order/inventory/auth/gateway/frontend` là scaffold/blueprint.

> ## ✅ Trạng thái thực hiện (cập nhật 2026-06-19)
> **Phase 0–5 ĐÃ HOÀN THÀNH** trên `customer-service` + `@erp/shared` + docs.
> Gates xanh: `npm run lint:check` (strict, 0 errors), `npm run build` (strict TS), `npm run test:cov` (36 unit tests, coverage ~97%/83% > ngưỡng 80/68), `npm run test:int` (4 integration tests trên Postgres thật). CI: job `backend` (strict lint + build + unit+coverage) + job `integration` (Postgres service + db push + test:int).
>
> **Caveat đã xử lý:**
> 1. ✅ **Schema đã áp lên Supabase** (additive DDL: unique `tax_code`, index `deleted_at`/`created_at`, trigram GIN, 4 cột outbox). `prisma db push` báo *in sync*. Verify: 0 rows, đủ index/cột.
> 2. ✅ **Lint hard gate STRICT** (`lint:check` = eslint không `--fix`).
> 3. ✅ **Integration test thật** (`test:int`) — repository chạy trên Postgres thật (Supabase local + CI Postgres service): unique/P2002, outbox-in-transaction, SKIP LOCKED claim, soft delete.
> 4. ⏳ **`creditUsedAmount` reservation** — thuộc `order-service` (Track C, đang làm).
>
> Track C (order/inventory/auth/gateway/frontend): đang triển khai.

---

## Nguyên tắc — 3 Track

| Track | Phạm vi | Hành động |
|---|---|---|
| **A — Code đã có** | `customer-service` + `@erp/shared` + DB + infra + tests | ✅ Sửa & củng cố ngay |
| **B — Docs** | (B1) docs phần **đã có** nhưng sai · (B2) blueprint phần **làm sau** nhưng thiết kế chưa chuẩn | ✅ Chỉnh sửa ngay (chỉ docs) |
| **C — Feature tương lai** | `order`, `inventory`, `auth`, `gateway`, `frontend` | ⏸️ Hoãn implement — build theo blueprint đã sửa chuẩn |

**Quy ước DB:** đang là prototype → được phép **sửa thẳng migration init** rồi `prisma db push` lại (không cần migration cộng dồn).

---

## Bản đồ Finding → Phase

| Finding | Mức | Track | Phase |
|---|---|---|---|
| C1 — Docs ≠ thực tế | 🔴 | B1 | 0 |
| C2 — Không unique taxCode + TOCTOU | 🔴 | A | 1 |
| C3 — `eventId` không truyền → idempotency vô dụng | 🔴 | A | 2 |
| C4 — Outbox không an toàn đa-instance | 🔴 | A | 2 |
| C5 — Migration chạy qua pooler | 🔴 | A | 1 |
| C6 — App table trong schema `auth` của Supabase | 🔴 | B2 | 5 |
| H1 — Không ValidationPipe/ExceptionFilter | 🟠 | A | 3 |
| H2 — Thiếu index DB | 🟠 | A | 1 |
| H3 — Invalidate cache cho namespace không cache | 🟠 | A | 3 |
| H4 — Tiền dùng float (number) | 🟠 | A | 1 |
| H5 — Gauge `outbox_pending` sai | 🟠 | A | 2 |
| H6 — Outbox không retention/DLQ | 🟠 | A | 2 |
| H7 — Không CI/CD | 🟠 | A | 0 |
| H8 — e2e hỏng + thiếu integration test | 🟠 | A | 0 + 4 |
| M1 — TS chưa strict | 🟡 | A | 3 |
| M2 — /health, /metrics hở & treo | 🟡 | A | 3 |
| M3 — CORS mở, thiếu helmet/rate-limit | 🟡 | A | 3 |
| M4 — `save()` findUnique ngoài transaction | 🟡 | A | 1 |
| M5 — Magic numbers | 🟡 | A | 3 |
| M6 — UUID sinh 2 lần (app + DB) | 🟡 | A | 1 |
| M7 — `console.log` trong main.ts | 🟡 | A | 3 |
| M8 — Lệch tên env (RUNTIME_DATABASE_URL) | 🟡 | B1 | 0 |
| M9 — Script `seed:admin` chết | 🟡 | B1 | 0 |
| M10 — README `npm run dev` sai | 🟡 | B1 | 0 |
| M11 — Idempotency mất event khi crash | 🟡 | A | 2 |

---

## Phase 0 — "Docs nói thật" + lưới an toàn ⏱️ 1–2 ngày

Mục tiêu: tài liệu ngừng mô tả thứ chưa tồn tại; có CI để refactor an toàn.

- [ ] Tạo `docs/IMPLEMENTATION-STATUS.md` — bảng ✅/🚧/⬜ theo service + feature *(C1)*
- [ ] Badge trạng thái đầu các doc blueprint: `auth/order/inventory-endpoints.md`, `rbac.md`, `event-flows.md` *(C1)*
- [ ] Ghi chú "partial" + link status cho: `system-overview.md`, `data-model.md`, `design-patterns.md`, `bounded-contexts.md` *(C1)*
- [ ] Sửa `README.md` (root): Quick Start phản ánh đúng (chỉ customer chạy; frontend chưa có) *(M10)*
- [ ] Sửa `docs/development/getting-started.md`: banner trạng thái + quickstart customer thật + annotate mục blueprint *(M8, M9, M10)*
- [ ] Thay e2e rác `customer-service/test/app.e2e-spec.ts` (test `GET /` → Hello World) *(H8)*
- [ ] Thêm CI tối thiểu `.github/workflows/ci.yml`: install → lint → typecheck → test (shared + customer) *(H7)*
- [ ] Sửa script chết: `scripts/package.json` (`seed:admin`), comment sai trong `create-schemas.js` *(M9)*

**DoD:** một dev mới clone về, đọc docs, chạy được `customer-service` mà không gặp lệnh/đường dẫn sai; CI xanh trên push.

---

## Phase 1 — Data integrity của customer-service ⏱️ 2–3 ngày

- [ ] **Partial unique taxCode** *(C2)*: `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`; bắt `P2002` ở create/update → `ConflictException`
- [ ] **Thêm index** *(H2)*: `deletedAt`, `taxCode`, `createdAt`, GIN `pg_trgm` cho `business_name`
- [ ] **Migration qua DIRECT_URL** *(C5)*: `prisma.config.ts` dùng `DIRECT_URL` (5432) thay `DATABASE_URL` (6543)
- [ ] **Tiền không dùng float** *(H4)*: domain dùng `bigint`/`Decimal`; cấm `.toNumber()` cho tiền
- [ ] **Gộp `save()` vào 1 transaction** *(M4)*: bỏ `findUnique` ngoài tx
- [ ] **Bỏ UUID trùng** *(M6)*: chốt 1 nguồn sinh id (app), sửa comment schema sai

**DoD:** không thể tạo 2 KH trùng MST dưới tải đồng thời; query theo name/taxCode dùng index; migrate chạy ổn qua direct connection.

---

## Phase 2 — Event pipeline đúng & scale-ready ⏱️ 2–3 ngày *(nền cho Saga sau này)*

- [ ] **Truyền `eventId`** *(C3)*: outbox row id → Pub/Sub message attribute; `buildEventMeta()` set `eventId`
- [ ] **Outbox an toàn đa-instance** *(C4)*: `SELECT ... FOR UPDATE SKIP LOCKED`, hoặc tách 1 relay single-writer
- [ ] **Sửa gauge** *(H5)*: `outbox_pending = COUNT(*) WHERE published_at IS NULL`
- [ ] **Retention + DLQ** *(H6)*: cột `attempts`, ngưỡng dead-letter, job dọn event đã publish
- [ ] **Event envelope versioned** *(C3, B2)*: `{ eventId, eventType, eventVersion, occurredAt, correlationId, payload }` trong `contracts/events.ts` + đồng bộ `event-flows.md`
- [ ] **Idempotency 2 trạng thái** *(M11)*: processing → done, tránh mất event khi consumer crash

**DoD:** chạy 2 instance worker không publish trùng; consumer dedup được bằng `eventId`; backlog outbox quan sát đúng qua metric.

---

## Phase 3 — API hardening & DX ⏱️ 1–2 ngày

- [ ] **ZodValidationPipe + global ExceptionFilter** *(H1)*: bỏ `@Body() body: any` và try/catch `error.name === 'ZodError'`. Sau đó **bật lint thành hard gate** trong CI (đổi `continue-on-error: true` → `false` ở `.github/workflows/ci.yml`)
- [ ] **Dọn cache vô nghĩa** *(H3)*: bỏ `invalidatePattern('customers:search:*')` (search không cache) hoặc cache search thật
- [ ] **Bật TS strict** *(M1)*
- [ ] **Bảo mật bề mặt** *(M2, M3)*: `helmet`, cors có cấu hình, rate-limit; `/health` tách live/ready + timeout; bảo vệ `/metrics`
- [ ] **Magic numbers → config** *(M5)*: page size, TTL, `POLL_INTERVAL_MS`, `BATCH_SIZE`
- [ ] **Log nhất quán** *(M7)*: thay `console.log` ở `main.ts` bằng logger

**DoD:** controller không còn `any`; lỗi validation trả format nhất quán qua filter; endpoint nội bộ không lộ public.

---

## Phase 4 — Testing & quality gate ⏱️ 1–2 ngày

- [ ] **Integration tests** *(H8)*: Testcontainers Postgres — repository + outbox transaction + soft-delete
- [ ] **Unit test còn thiếu**: update/delete/get/search/check-credit command
- [ ] **Coverage threshold** trong CI (vd ≥70% domain/application)

**DoD:** CI chạy unit + integration; ngưỡng coverage được enforce.

---

## Phase 5 — Sửa blueprint cho phần làm sau (CHỈ docs) ⏱️ 1–2 ngày

Track B2 — sửa thiết kế chưa chuẩn để khi build theo là đúng. **Không code service mới.**

- [ ] **Auth schema** *(C6)*: đổi blueprint `auth` (Supabase reserved) → `app_auth` trong `data-model.md` + `create-schemas.js`
- [ ] **RBAC placement**: `rbac.md` đang nói check 100% ở gateway → sửa thành gateway authn + authz thô, service enforce authz tài nguyên
- [ ] **Refresh token**: `auth-endpoints.md` thêm rotation + reuse-detection (không chỉ blacklist); nêu bcrypt cost
- [ ] **Đồng bộ data-model**: chốt 1 phiên bản schema customer khớp code thật (taxCode nullable + partial unique, có `deleted_at`); bỏ field thừa trong plan
- [ ] **Optimistic locking**: định nghĩa nhất quán cột `version` + retry cho order/inventory blueprint
- [ ] **Bổ sung ADR**: outbox scale-out, event envelope versioned, money type, authz placement, migration DIRECT_URL

**DoD:** blueprint tương lai không còn anti-pattern; bất kỳ ai build theo docs sẽ ra thiết kế chuẩn.

---

## Track C — Build các service còn lại (đang triển khai)

| Service | Trạng thái | Ghi chú |
|---|---|---|
| `inventory-service` | ✅ **Done** | DDD + CQRS + Outbox + **Optimistic Locking** (version + retry/backoff). 27 unit test (cov ~99%), integration test concurrent-reserve trên Supabase. Schema đã áp. |
| `order-service` | ⬜ Next | Saga/CQRS/Aggregate Root; **resolve caveat 4** (reserve credit + inventory). Cần thêm **Pub/Sub consumer infra** vào `@erp/shared` (hiện mới có publisher). |
| `auth-service` | ⬜ | JWT + bcrypt + RBAC, schema `app_auth` (ADR-014), refresh-token rotation (ADR + auth-endpoints). |
| `api-gateway` | ⬜ | Routing + verify JWT + authz thô (ADR-012). |
| `frontend` | ⬜ | Next.js 15 + Ant Design 5. |

Thứ tự đề xuất: order (cần consumer infra) → auth → gateway → frontend. Mỗi service copy outbox/observability từ `@erp/shared` (đã củng cố ở Phase 0–5 nên không nhân bản lỗi).

---

## Tổng thời lượng ước tính

| Phase | Ngày | Loại |
|---|---|---|
| 0 | 1–2 | Docs + CI |
| 1 | 2–3 | Code (DB) |
| 2 | 2–3 | Code (events) |
| 3 | 1–2 | Code (API) |
| 4 | 1–2 | Test |
| 5 | 1–2 | Docs |
| **Tổng** | **~8–13** | đưa nền lên mức "vững để nhân bản" |
