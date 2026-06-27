# E2E Tests — ERP Prototype

End-to-end tests that run against all services via the API Gateway (`localhost:3010`).

## Prerequisites

1. All 6 services + API Gateway + Pub/Sub Emulator running
2. Auth accounts seeded in DB:
   - `admin@gmail.com` / `Admin@123` (role: admin)
   - `manager@gmail.com` / `Manager@123` (role: manager)
   - `staff@gmail.com` / `Staff@123` (role: staff)
3. Database schemas migrated

## Quick Start

```bash
# 1. Start infra (Pub/Sub emulator)
cd backend
docker compose up -d

# 2. Start all services (native, with hot-reload)
npm run dev:all

# 3. Wait for services to be ready (~10s)
# Check: curl http://localhost:3010/api/auth/login -X POST -d '{}' -H 'Content-Type: application/json'
# Should return 400 (not connection refused)

# 4. Run E2E tests (in another terminal)
npm run test:e2e
```

## Test Suites (sequential order)

| # | Suite | Description | Tests |
|---|-------|-------------|:-----:|
| 01 | Health | Smoke test — gateway alive | 3 |
| 02 | Auth | JWT login, refresh, logout | 9 |
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
