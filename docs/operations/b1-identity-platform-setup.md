---
type: Runbook
title: B1 — Identity Platform Setup (Google sign-in)
description: Các bước để chạy thật B1 (Google sign-in qua GCP Identity Platform + session whitelist) — GCP Console, Terraform, DB SQL, env, allowlist, E2E revoke test.
tags: [auth, identity-platform, firebase, sso, gcp, terraform, runbook, b1]
timestamp: 2026-07-08
diataxis: how-to
---

# B1 — Identity Platform Setup (Google sign-in)

Runbook để **chạy thật** migration B1: đăng nhập bằng Google qua GCP **Identity
Platform** + lớp **session whitelist** (revoke tức thì FR-A13, idle timeout FR-A9).
Code/infra đã xong; runbook này là phần cấu hình cần bàn tay người (GCP creds,
`terraform apply`, SQL, seed) — không tự động hoá được hết.

> Bối cảnh & quyết định: [Auth Gap](../gap/prototype-vs-newdesign-auth-gap.md) ·
> [ADR-015 trong Tech Decisions](../overview/tech-decisions.md) ·
> [Auth Endpoints](../api/auth-endpoints.md).

## Bối cảnh nhanh

- Login = "Sign in with Google" (Firebase JS SDK) → Firebase ID token →
  `POST /auth/sso/callback` → **app access token** (HS256, có `sid`, TTL 1h).
- **Chưa có Google Workspace domain** → access gate bằng **allowlist email** trong
  bảng `app_auth.users` (không phải `hd` domain). Email lạ → `403`.
- Gateway verify app token → check `session:<sid>` (Redis) → miss = `401`.
- Credential admin cho auth-service (verify/revoke) lấy qua **ADC** (local) hoặc
  service account gắn Cloud Run (prod) — **không tải key file**.

## Cần lấy 4 giá trị từ GCP

`apiKey`, `authDomain` (cho frontend) · `client_id`, `client_secret` (cho Terraform).

---

## Bước 1 — GCP Console

**1a. Bật Identity Platform** — Console → project `portfolio-497506` → search
**Identity Platform** → **Enable** / **Get started**.

**1b. `apiKey` + `authDomain`** — Identity Platform → **Application setup details**
(góc trên phải) → copy `apiKey` và `authDomain` (thường `portfolio-497506.firebaseapp.com`).

**1c. OAuth consent screen** — APIs & Services → **OAuth consent screen** →
User type **External** → điền App name + support email →
⚠️ **thêm Gmail của bạn vào "Test users"** (chế độ Testing chỉ cho test user login;
hoặc Publish app).

**1d. OAuth client → `client_id` + `client_secret`** — APIs & Services →
**Credentials** → Create credentials → **OAuth client ID** → **Web application**:
- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs: `https://portfolio-497506.firebaseapp.com/__/auth/handler`

Copy **Client ID** + **Client secret**.

**1e. Authorized domains** — Identity Platform → **Settings → Authorized domains**
→ đảm bảo có `localhost`.

---

## Bước 2 — Terraform

Thêm vào cuối `infra/environments/dev/terraform.tfvars` (file thật, không phải `.example`):

```hcl
google_oauth_client_id     = "<Client ID từ 1d>"
google_oauth_client_secret = "<Client secret từ 1d>"
auth_authorized_domains    = ["localhost"]
```

```bash
cd infra/environments/dev
terraform init      # nếu chưa init
terraform plan      # +identity_platform config, +google IdP, +SA, +IAM binding
terraform apply
```

Apply sẽ: enable API `identitytoolkit`, dựng Identity Platform config, bật Google
IdP (bằng client_id/secret), tạo SA `auth-svc-admin`, và grant
`roles/firebaseauth.admin` cho SA **`erp-backend-dev`** (auth-service chạy được ngay;
Cloud Run do Cloud Deploy quản `deploy/auth-service/service.yaml`, chạy bằng SA này).

> **Gotcha:** nếu apply báo *identity platform config already exists* (do 1a đã provision):
> `terraform import module.identity_platform.google_identity_platform_config.default portfolio-497506`
> rồi `apply` lại.

---

## Bước 3 — DB (SQL tay → regenerate Prisma client)

> Không dùng migration runner (theo [runbook đổi schema](./run-backend-with-prod-config.md)).
> SQL idempotent + non-destructive.

```bash
psql "$DIRECT_URL" <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS app_auth.sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_auth.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip text, user_agent text
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON app_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON app_auth.sessions(expires_at);
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS firebase_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid ON app_auth.users(firebase_uid);
ALTER TABLE app_auth.users ALTER COLUMN password_hash DROP NOT NULL;
COMMIT;
SQL

cd backend/auth-service && npm run db:generate
```

`app_auth.refresh_tokens` để **deprecated** (chưa drop) — dọn sau khi B1 confirm prod.

---

## Bước 4 — Env

- **FE** `frontend/.env`: điền `NEXT_PUBLIC_FIREBASE_API_KEY` + `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` + `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (cả 3 cùng 1 project, lấy từ 1b). Nếu đang bật `NEXT_PUBLIC_AUTH_BYPASS=1` thì comment lại để test login thật.
- **Backend** `backend/.env`: điền `DATABASE_URL`/`DIRECT_URL` (Supabase), `UPSTASH_REDIS_REST_URL/TOKEN`, `JWT_SECRET`. `FIREBASE_PROJECT_ID` đã sẵn; **để `GOOGLE_APPLICATION_CREDENTIALS` comment** (dùng ADC).
- **ADC** (credential local cho firebase-admin, khỏi tải key):

```bash
gcloud auth application-default login
gcloud config set project portfolio-497506
```

---

## Bước 5 — Allowlist Gmail + chạy

```bash
# Allowlist Gmail của bạn (email không có trong users → 403)
cd backend/auth-service
SEED_ADMIN_EMAIL=you@gmail.com npm run db:seed

# Chạy backend + gateway + frontend theo cách vẫn dùng
```

## E2E revoke test (thủ công)

> Cần Identity Platform (hoặc Firebase emulator) + Redis + DB đang chạy.

1. FE `localhost:3000` → **Sign in with Google** → chọn Gmail đã allowlist → vào app.
2. Gọi 1 trang protected → `200`.
3. **Logout** → gọi lại API đó → **`401` trong vài giây** (không đợi hết TTL token).
4. Admin `PATCH /api/auth/users/:id {isActive:false}` cho user khác → token của họ → **`401` ngay** (FR-A13).

## Thứ tự phụ thuộc

`Bước 1` → (`Bước 2` và `Bước 3` song song) → `Bước 4` → `Bước 5`.

## Troubleshooting

- **`terraform apply` báo config đã tồn tại** → `terraform import` như Gotcha ở Bước 2.
- **Login được nhưng `403 not provisioned`** → email chưa có trong `app_auth.users`; chạy lại Bước 5 với `SEED_ADMIN_EMAIL`, hoặc admin `POST /auth/register`.
- **Popup Google chặn / `unauthorized_domain`** → thiếu `localhost` ở Authorized domains (1e) hoặc redirect URI (1d) sai.
- **Login bằng Gmail báo access_denied** → consent screen ở Testing mà Gmail chưa nằm trong Test users (1c).
- **Mọi request `401 Session expired`** → Redis (Upstash) không kết nối được. Gateway **fail-closed** cố ý (outage = phải login lại) — kiểm `UPSTASH_REDIS_REST_URL/TOKEN`.

## Related Concepts

- [Auth Endpoints](../api/auth-endpoints.md) — `/auth/sso/callback`, `/auth/logout`
- [Auth Gap Analysis](../gap/prototype-vs-newdesign-auth-gap.md) — B1 khớp/lệch design D-004
- [Tech Decisions](../overview/tech-decisions.md) — ADR-015 (B1)
- [RBAC](../architecture/rbac.md) — session whitelist + `x-user-sid`
- [Implementation Status](./implementation-status.md) — trạng thái auth
