---
type: Runbook
title: UI D365 Rollout & BE↔FE Backlog
description: Trạng thái rollout UI Power Apps/D365, các fix từ review đã áp dụng, và backlog chức năng BE→FE còn lại + việc cần deploy.
tags: [frontend, ui, backlog, review, d365, roadmap]
timestamp: 2026-07-02
diataxis: how-to
---

# UI D365 Rollout & BE↔FE Backlog

Bản ghi trạng thái sau đợt re-theme UI theo **Power Apps model-driven / Dynamics 365
Unified Interface** và đợt review dự án. Dùng để lên kế hoạch phần còn lại.

> [!NOTE]
> Nguồn sự thật trạng thái implement tổng: [Implementation Status](./implementation-status.md).
> Plan gốc (URL fix + DB + pilot Catalog): [Frontend Fix & UI Revamp Plan](../archive/frontend-fix-and-ui-revamp-plan.md).

## Bối cảnh

Brand color chốt: **`#3899B4`** (rgb 56,153,180). Ràng buộc: giữ **Tailwind + AntD**, chỉ
re-theme token + layout, không đổi thư viện. Logo/favicon: URL gstatic (đặt ở
`AppShell.tsx` + `layout.tsx` `metadata.icons`).

## Đã hoàn thành

### 1. Khung UI D365 (toàn app)
- **Top bar brand full-width** (logo + tên app + Settings + user menu) + **sidebar trắng**
  kiểu site-map: nhóm co/mở được (submenu), item chọn có **accent trái**, nút thu/mở ở
  **trên cùng sidebar**, thu gọn thì bỏ group → icon rail. Căn trái (`inlineIndent=16`).
- **Primitive dùng chung**: `components/d365/CommandBar.tsx`, `components/d365/FormLayout.tsx`
  (`FormSection`, `Field`).
- **List pages** (catalog, customers, orders, inventory, purchasing, suppliers): view-picker
  (tên view + ▾) + CommandBar (New/Refresh/Delete + ⋮ Export/Edit columns) + grid phẳng
  (sort header, checkbox rowSelection, link cột tên, "Rows: N"). Bỏ stat-cards/filter-card/breadcrumb.
- **Detail pages**: form dạng Tabs (General/Related) + `FormSection`/`Field` (label trái, value gạch chân).
- **Dashboard `/`**: giữ KPI + charts (hợp lệ Power Apps dashboard), chỉ đổi màu brand + radius 4.

### 2. Fix lỗi thật (từ review — xem [Technical Review](../technical-review.md))
| Lỗi | Fix | Vị trí |
|-----|-----|--------|
| Xoá dòng đơn → 404 | Thêm route `DELETE /v1/orders/:id/lines/:lineId` (domain + use-case + repo) | sales-service |
| Filter `status` khách hàng bị bỏ qua | list nhận + lọc `status` | customer-service |
| Filter ngày đơn bị bỏ qua | list nhận `createdFrom/createdTo` | sales-service |
| Dead code `updateLine` (FE gọi route không tồn tại) | Đã xoá | `lib/api/sales.ts` |
| A11y bàn phím | view-picker `<a>`→role=button+keydown; toggle sidebar keyboard; `aria-label` cho search/overflow/EmptyState | AppShell + list pages |

### 3. Chức năng BE mới có UI
| Feature | UI |
|---------|-----|
| **User Management** (admin) | Trang `/users`: list + tạo user + **search server-side** (auth-service `GET /auth/users?q=`); nav "Administration → Users" chỉ hiện admin |
| **RBAC — Roles & Permissions** (admin, read-only) | Trang `/roles`: ma trận **role × quyền** (render từ `lib/auth/permissions.ts` — một nguồn sự thật, `CAN` cũng derive từ đây nên UI không lệch enforce); nav "Administration → Roles & Permissions" |
| Session `/me` | Gọi lúc bootstrap để hydrate/validate (best-effort, không đăng xuất khi lỗi) |
| Order **Fulfil** | Nút trên command bar `orders/[id]` |
| Delivery **Fail** | Nút + lý do trong DeliveryTab |
| Inventory **Issue** (xuất kho) | Nút + modal trên `inventory/[sku]` |
| Credit-check what-if | Input orderAmount/pendingTotal ở card Credit Check |

### 4. Tiện ích dev
- **Auth bypass** dev-only: `NEXT_PUBLIC_AUTH_BYPASS=1` (khoá cứng non-production).
- Chạy BE local với prod config: xem [Run Backend with Prod Config](./run-backend-with-prod-config.md).

## Backlog còn lại

| # | Việc | Loại | Ghi chú |
|---|------|------|---------|
| 1 | **Deploy 3 service BE** (sales, customer, auth) | ⚠️ Deploy | Fix remove-line/filter + Users search chỉ chạy local tới khi deploy |
| 2 | Deploy **gateway Swagger 1C** (`/docs` transform) | Deploy | Code xong, chưa build/deploy — revision live `00012` (2026-07-01) là CORS env-update, chưa có 1C |
| 3 | ~~Bật Public IP Cloud SQL~~ | ✅ Done | `ipv4Enabled=true`, IP public `35.223.195.43` (verify 2026-07-02); code `enable_public_ip=true` khớp state |
| 4 | **Commit + push** toàn bộ | Git | Người dùng tự làm |
| ~~5~~ | ~~User edit/deactivate~~ | ✅ Done | `PATCH /auth/users/:id` (đổi role + isActive, admin-gated, chặn self-lockout) + UI Edit role / Activate-Deactivate ở trang Users |
| 6 | Refactor file quá dài (`orders/[id]` 777 dòng, `api-gateway/main.ts` 611) | Tech-debt | Không lỗi chức năng; tách component |
| 7 | Inventory `reserve/release/batch` | — | **Saga-internal, KHÔNG cần UI** |
| 8 | **RBAC động (sửa quyền qua UI)** | 🔵 Optional | Cần tách bảng `roles`/`permissions` + BE CRUD + gateway đọc quyền từ DB. Hiện đã có trang xem ma trận read-only (`/roles`); chỉ làm khi cần quản lý quyền động |

## Review — tín hiệu đo được (measure, don't guess)

| Dimension | 🔴 | 🟠 | 🟡 | Thực chất |
|-----------|----|----|----|-----------|
| Code | 0 | 4 | 78 | 4 file quá dài; console leftover là script CLI (hợp lệ) |
| Security | 12 | 1 | 27 | **12 "blocking" = credential trong file test (fixture)** → false-positive; `.env` đã gitignored |
| UI/UX | 0 | 35 | 6 | ~33 là AntD Form.Item (false-positive); lỗi keyboard thật đã fix |

> [!WARNING]
> Đừng "đuổi theo" 12 secret blocking — chúng là test fixture, không phải secret rò rỉ.
> Scan tĩnh chưa đánh giá authz sâu và posture `ingress=all` (IAM-gated, đã bàn ở review).

## Verify

- Frontend: `tsc --noEmit` sạch + `next build` pass **12/12 route** (gồm `/users`).
- Backend đổi: `sales-service`, `customer-service`, `auth-service` đều `tsc --noEmit` exit 0.

## Related Concepts

- [Frontend Fix & UI Revamp Plan](../archive/frontend-fix-and-ui-revamp-plan.md) — plan gốc của đợt UI
- [Technical Review](../technical-review.md) — đánh giá kỹ thuật toàn diện
- [Implementation Status](./implementation-status.md) — source of truth trạng thái
- [Run Backend with Prod Config](./run-backend-with-prod-config.md) — chạy BE local trỏ prod
- [RBAC](../architecture/rbac.md) — phân quyền (liên quan admin-gated Users)
