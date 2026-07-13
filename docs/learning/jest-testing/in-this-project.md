---
type: Reference
title: "Jest in This Project"
description: "Mapping Jest → backend NestJS ERP: ts-jest, config inline mỗi service + e2e, cấu trúc test DDD/CQRS, tích hợp CI (verify chặn deploy). Frontend không dùng Jest"
tags: [jest, terraform, erp, nestjs, ts-jest, ci, ddd, cqrs]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://backend/auth-service/package.json"
---

# Jest in This Project

> Jest test toàn bộ **backend NestJS** (7 service + shared). Frontend **không** dùng Jest. Config theo ts-jest, inline trong package.json mỗi service; e2e riêng.

> Liên quan: [Cloud Build](../cloud-build/in-this-project.md) (CI verify) · [Redis](../redis/index.md) · [Pub/Sub](../pubsub/index.md)

---

## 1. Phạm vi

| Phần | Jest? | Ghi chú |
|---|---|---|
| 7 backend service (NestJS) | ✅ | Unit + e2e |
| `backend/shared` | ✅ | Test lib dùng chung |
| frontend (Next.js) | ❌ | Không có Jest (package.json không có test tooling) |

**41** file `*.spec.ts` trên backend.

## 2. Cấu hình — ts-jest, inline trong package.json

Source: [`backend/auth-service/package.json`](../../backend/auth-service/package.json)

```jsonc
{
  "scripts": {
    "test":       "jest",
    "test:watch": "jest --watch",
    "test:cov":   "jest --coverage",
    "test:e2e":   "jest --config ./test/jest-e2e.json"
  },
  "devDependencies": {
    "@nestjs/testing": "^11", "jest": "^30", "ts-jest": "^29",
    "supertest": "^7", "@types/jest": "^30", "@types/supertest": "^7"
  },
  "jest": {
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    ...   // moduleNameMapper: '@erp/shared' → '../shared/src'
  }
}
```

| Điểm | Ghi chú |
|---|---|
| **ts-jest** | Chạy test TypeScript trực tiếp (transform) |
| **@nestjs/testing** | `Test.createTestingModule` dựng DI container test |
| **supertest** | E2E: bắn HTTP thật vào app |
| `moduleNameMapper` | `@erp/shared` → `../shared/src` (backend không dùng npm workspaces) |
| `api-gateway` | `jest --passWithNoTests` (gateway ít/không unit test) |

## 3. Cấu trúc test — DDD / CQRS

```
backend/<service>/
├── test/domain/*.spec.ts               # unit: domain entity (business rule thuần)
├── test/application/*.spec.ts          # unit: command/query handler
├── src/application/commands/*.spec.ts  # unit co-located: create/update/delete command
├── src/application/queries/*.spec.ts   # unit co-located: get/search/check query
└── test/jest-e2e.json                  # config e2e (supertest)
```

Ví dụ file thật: `test/domain/user.entity.spec.ts`, `src/application/queries/check-credit.query.spec.ts`, `src/application/commands/create-customer.command.spec.ts`.

> [!NOTE]
> Test bám theo kiến trúc **DDD + CQRS**: domain entity (rule thuần, dễ unit test), command/query handler (mock repository ở ranh giới). Đây là lý do pyramid nghiêng về **unit** — xem [Best Practices §7](./best-practices.md).

## 4. E2E — 2 cấp

| Cấp | File | Ghi chú |
|---|---|---|
| Per-service e2e | `backend/<service>/test/jest-e2e.json` | supertest → app service |
| Cross-service e2e | `backend/test/e2e/jest.e2e.config.ts` | `jest --runInBand --forceExit` (chạy tuần tự, thoát cưỡng bức) |

## 5. Tích hợp CI — quality gate

Source: [`.github/workflows/ci-backend.yml`](../../.github/workflows/ci-backend.yml)

```
detect-changes (paths-filter) → verify (matrix mỗi service đổi):
   1. build+test shared      (npm run typecheck + build + test)
   2. npm ci service + prisma generate
   3. npm run lint:check
   4. npm test               ← Jest chạy ở đây
   → PASS thì mới sang build-and-push (docker build + push image)
   → FAIL chặn build & deploy
```

| Điểm | Ghi chú |
|---|---|
| **Chỉ verify service đổi** | paths-filter; shared đổi → verify tất cả |
| **Test là quality gate** | Jest fail → không build+push → không deploy |
| **shared test trước** | `@erp/shared` phải build + pass trước khi service resolve được |

> [!IMPORTANT]
> Jest ở đây là **cửa chặn**: `npm test` fail ở bất kỳ service đổi nào → CI đỏ → [Cloud Build/Cloud Deploy](../cloud-build/in-this-project.md) không chạy → prod không nhận bản lỗi.

## Related Concepts

- [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)
- [Best Practices](./best-practices.md) — AAA, mock ranh giới, DDD
- [Cloud Build](../cloud-build/index.md) — CI verify → build → deploy
