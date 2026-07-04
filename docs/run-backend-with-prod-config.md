---
type: Runbook
title: Run Backend with Prod Config
description: Chạy 6 service + api-gateway ở local nhưng trỏ tài nguyên PROD (Cloud SQL Auth Proxy + script dev:prod).
tags: [backend, local-dev, cloud-sql, proxy, runbook]
timestamp: 2026-07-02
diataxis: how-to
---

# Chạy Backend LOCAL với cấu hình PRODUCTION (`backend/.env.production`)

Mục đích: chạy 6 service + api-gateway **ở máy local** nhưng trỏ vào **tài nguyên
PROD** (Cloud SQL, Upstash Redis, Pub/Sub, JWT thật) để kiểm tra hành vi giống
prod mà **không cần deploy** lên Cloud Run.

> ⚠️ `backend/.env.production` chứa secret thật → đã `.gitignore`. **Không commit.**

---

## ⭐ Chọn cách theo việc bạn đang làm

### Tier 1 — Chỉ làm Frontend/UI → **KHÔNG cần chạy BE local**
Backend đã deploy và chạy tốt (login 200, CORS ok). Chỉ cần trỏ FE vào gateway đã deploy:
```powershell
cd erp-prototype-example/frontend
$env:NEXT_PUBLIC_API_GATEWAY = "https://api-gateway-dev-s3fou5y5yq-uc.a.run.app"
npm run dev   # http://localhost:3000
```
**Zero setup**: không proxy, không Cloud SQL, không Public IP. Đây là cách tiện nhất cho công việc UI hiện tại. (URL này = đúng biến `NEXT_PUBLIC_API_GATEWAY` bạn đã set ở GitHub env `dev`.)

### Tier 2 — Cần sửa/debug Backend → chạy BE local với 1 lệnh
`npm run dev:prod` giờ **tự khởi động Cloud SQL Auth Proxy** rồi mới chạy 7 service (dùng
`wait-on` chờ cổng 5432 sẵn sàng). Điều kiện: **Public IP đang bật** (xem dưới) + có binary
`cloud-sql-proxy` trong PATH.
```powershell
cd erp-prototype-example/backend
npm run dev:prod
```
Ctrl+C tắt cả proxy lẫn service (`concurrently -k`).

> Để khỏi bật/tắt Public IP mỗi lần: cân nhắc **để Public IP luôn qua Terraform**
> (`ipv4_enabled = true` + `ssl_mode = "ENCRYPTED_ONLY"`, `authorized_networks` để trống).
> Instance dev/prototype nên chấp nhận được; xem thảo luận trade-off trong chat/plan.

---

## Vì sao cần Cloud SQL Auth Proxy?

Cloud SQL `erp-postgres-dev` **chỉ có Private IP** (`10.182.96.3`). Máy local không
nằm trong VPC nên **không nối thẳng** được. Auth Proxy mở một tunnel mã hoá và
lắng nghe ở `127.0.0.1:5432` — đúng host/port mà `DATABASE_URL`/`DIRECT_URL` trong
`.env.production` đang trỏ tới.

Proxy chạy từ máy local kết nối Cloud SQL qua **Public IP** của instance. Vì bạn đã
**tắt Public IP**, phải **bật lại tạm** trong lúc chạy, xong **tắt lại** cho an toàn.
(Proxy dùng IAM + SSL nên **không cần** khai báo Authorized Networks.)

---

## Chuẩn bị (chỉ làm 1 lần)

```powershell
# 1. Application Default Credentials (proxy + Pub/Sub cần) — máy này đã có sẵn.
gcloud auth application-default login

# 2. Cài dependencies + generate Prisma client cho tất cả service (nếu chưa).
cd erp-prototype-example/backend
npm run install:all
npm run prisma:all

# 3. Cloud SQL Auth Proxy: cần binary `cloud-sql-proxy` trong PATH.
#    Nếu chưa có, tải: https://cloud.google.com/sql/docs/postgres/sql-proxy
```

---

## Các bước chạy

### ① Bật Public IP tạm cho Cloud SQL
Console → **SQL → `erp-postgres-dev` → Connections → Networking** → tick **Public IP**
→ **Save** (chờ ~1–2 phút instance cập nhật).

> gcloud tương đương (bạn tự chạy — lệnh này bị chặn ở chế độ auto vì nới lỏng
> mạng): `gcloud sql instances patch erp-postgres-dev --assign-ip`

### ② Backend + proxy trong 1 lệnh
```powershell
cd erp-prototype-example/backend
npm run dev:prod
```
`dev:prod` = `concurrently -k` chạy song song:
1. `db:proxy` → `cloud-sql-proxy … --port 5432`
2. `wait-on tcp:127.0.0.1:5432 && dev:prod:services` → chờ proxy sẵn sàng rồi mới
   `dotenv -e .env.production -- concurrently <6 service + gateway>`.

`dotenv-cli` nạp `.env.production` vào `process.env`; `concurrently` spawn từng service kế
thừa env đó (mỗi service đọc qua `ConfigService`). Gateway ở `http://localhost:3010`;
service ở `3001–3006`. **Ctrl+C tắt cả proxy lẫn service** (nhờ `-k`).

> **Fallback** (nếu proxy không chịu chạy chung, ví dụ binary không trong PATH): chạy proxy
> riêng ở Terminal 1 (`npm run db:proxy`) rồi `npm run dev:prod:services` ở Terminal 2.

### ④ (Tùy chọn) Frontend local trỏ vào gateway local
```powershell
cd erp-prototype-example/frontend
# NEXT_PUBLIC_* được inline lúc build/dev → set trước khi chạy dev:
$env:NEXT_PUBLIC_API_GATEWAY = "http://localhost:3010"
npm run dev   # http://localhost:3000
```
CORS đã cho phép `http://localhost:3000` trong `.env.production`.

Đăng nhập thử: `admin@gmail.com / Admin@123` (hoặc manager/staff — đã seed).

---

## Dọn dẹp sau khi xong
1. `Ctrl+C` ở Terminal 2 (backend) và Terminal 1 (proxy).
2. **Tắt Public IP** lại: Console → SQL → `erp-postgres-dev` → Connections →
   bỏ tick Public IP → Save. (Hoặc `gcloud sql instances patch erp-postgres-dev --no-assign-ip`.)

---

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Proxy: `failed to connect… no public IP` | Public IP đang tắt | Làm lại bước ① |
| Service: `Can't reach database at 127.0.0.1:5432` | Proxy chưa chạy / đã tắt | Bật lại Terminal 1 |
| `password authentication failed` | Sai password/URL-encode | Password có `@` → phải là `%40` trong URL (đã đúng trong file) |
| `relation "…outbox" does not exist` | Schema chưa migrate | Chạy `prisma db push` cho service đó qua proxy (xem Part 3 trong plan) |
| Biến prod bị "đè" bởi giá trị localhost | Service có `.env` riêng bật `override` | Xóa/đổi tên `.env` cục bộ trong thư mục service đang xung đột |
| Pub/Sub `PERMISSION_DENIED` | ADC hết hạn | Chạy lại `gcloud auth application-default login` |

> Muốn test **cô lập** (không đụng Cloud SQL/Pub/Sub prod): bỏ comment
> `PUBSUB_EMULATOR_HOST` trong `.env.production` + `docker compose up -d`, và trỏ
> DB về Postgres local. Xem plan Part 3.
