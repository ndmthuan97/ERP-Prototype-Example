# E2E Tests — ERP Prototype

End-to-end tests that run against all services via the API Gateway (`localhost:3010`).

## Prerequisites

1. All 6 services + API Gateway + Pub/Sub Emulator running
2. **One allowlisted Google account** in `app_auth.users` with the **admin** role
   (seeding creates customers/products/etc., which needs write access)
3. A **fresh Firebase ID token** for that account, exported as `E2E_ID_TOKEN`
   (see [Getting an E2E_ID_TOKEN](#getting-an-e2e_id_token) below). Password login
   was removed in B1 — the harness authenticates via `POST /auth/sso/callback`.
4. Database schemas migrated

## Quick Start

```bash
# 1. Start infra (Pub/Sub emulator)
cd backend
docker compose up -d

# 2. Start all services (native, with hot-reload)
npm run dev:all

# 3. Wait for services to be ready (~10s)
# Check: curl http://localhost:3010/api/auth/sso/callback -X POST -d '{}' -H 'Content-Type: application/json'
# Should return 400 (not connection refused)

# 4. Run E2E tests (in another terminal) with a fresh ID token
export E2E_ID_TOKEN="<paste a fresh Firebase ID token — see below>"
npm run test:e2e
```

## Getting an E2E_ID_TOKEN

Under B1 the only way in is Google sign-in, so the harness needs a real Firebase
ID token for an allowlisted admin. It expires ~1h after minting — grab a fresh one
right before a run:

- **From the running frontend (easiest):** sign in with Google at the app, then in
  the browser DevTools console run
  `await firebase.auth().currentUser.getIdToken()` (or read the token the app sent
  to `/auth/sso/callback` in the Network tab) and copy the string.
- **Headless (CI):** point the backend at the Firebase Auth Emulator
  (`FIREBASE_AUTH_EMULATOR_HOST`) and mint a token against it — not wired up yet;
  see the auth-gap doc for the forward path.

The token's email must exist in `app_auth.users` with the `admin` role.

## Test Suites (sequential order)

| # | Suite | Description | Tests |
|---|-------|-------------|:-----:|
| 01 | Health | Smoke test — gateway alive | 3 |
| 02 | Auth | SSO exchange, session whitelist, instant revoke (FR-A13) | 5 |
| 03 | Catalog | Product CRUD + cross-context event | 8 |
| 04 | Customer | Customer CRUD + credit check | 7 |
| 05 | Inventory | Stock operations + optimistic locking | 10 |
| 06 | Purchasing | Supplier + PO lifecycle + goods receipt | 13 |
| 07 | **Sales Saga** ⭐ | SO lifecycle + saga compensation | 18 |
| 08 | Delivery | DO 6-state + partial delivery | 11 |
| 09 | Return | Sales return lifecycle | 7 |

**Total: ~80+ test cases**

## Architecture

```
test/e2e/
├── helpers/
│   ├── api.ts          — Axios client with auto JWT
│   ├── wait-for.ts     — Polling for async events (saga)
│   ├── seed.ts         — Creates baseline test data
│   └── cleanup.ts      — Soft-cleanup utilities
├── suites/             — Test files (01-09, ordered)
└── jest.e2e.config.ts  — Jest config (60s timeout, sequential)
```

## Important Notes

- Tests run **sequentially** (`--runInBand`) because later suites depend on earlier data
- Saga tests use `waitFor` polling (500ms interval, 20s timeout) for async Pub/Sub events
- Rate limiting: API Gateway has 100 req/15 min. If tests fail with 429, restart gateway
- Tests create data with `E2E-` prefix in names/SKUs for easy identification
