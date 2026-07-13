---
type: Learning Note
title: "Jest Testing Overview"
description: "Tại sao viết test, các loại test (unit/integration/e2e), test pyramid, tại sao chọn Jest, so sánh với Vitest / Mocha"
tags: [learning, jest, testing, unit-test, e2e, test-pyramid]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Jest Testing Overview

## Summary

**Jest** = test framework JavaScript/TypeScript "pin sẵn" (test runner + assertion + mocking + coverage trong một). Trong ERP, Jest test toàn bộ backend NestJS: domain logic, commands/queries (CQRS), và e2e API.

```
   Không test                          Có test (Jest)
  ┌────────────────────┐             ┌──────────────────────────┐
  │ sửa code → hy vọng │             │ sửa code → chạy test →   │
  │ không vỡ chỗ khác  │    ──▶      │ biết ngay vỡ chỗ nào     │
  │ (bug lộ ở prod)    │             │ (bug lộ ở CI, chặn deploy)│
  └────────────────────┘             └──────────────────────────┘
```

## Key Concepts

### Vì sao test?

| Không test | Có test |
|---|---|
| Refactor = sợ vỡ ngầm | Refactor an toàn (test bắt regression) |
| Bug lộ ở production | Bug lộ ở CI, chặn deploy |
| Tài liệu hành vi = code + trí nhớ | Test **là** tài liệu hành vi sống |

> [!IMPORTANT]
> Test không phải để "đạt 100% coverage" mà để **tự tin thay đổi code**. Test tốt = khi refactor, nó fail đúng chỗ hành vi hỏng, không fail vì đổi cách viết.

### Các loại test & Test Pyramid

```
        ▲  ít, chậm, đắt
       /E2E\        ← chạy cả hệ thật (HTTP → DB) — supertest
      /─────\
     /Integr.\      ← nhiều module thật ghép lại
    /─────────\
   /   Unit    \    ← 1 đơn vị, mock phụ thuộc — nhanh, nhiều
  ▔▔▔▔▔▔▔▔▔▔▔▔▔  nhiều, nhanh, rẻ
```

| Loại | Phạm vi | Tốc độ | Số lượng |
|---|---|---|---|
| **Unit** | 1 hàm/class, mock ngoài | Nhanh (ms) | Nhiều |
| **Integration** | Nhiều module thật | Vừa | Vừa |
| **E2E** | Cả hệ (HTTP→DB) | Chậm | Ít |

> **Nguyên tắc pyramid**: nhiều unit (nhanh, rẻ), ít e2e (chậm, đắt). Đảo ngược (nhiều e2e) → CI chậm, flaky.

### Vì sao Jest?

- **All-in-one**: runner + `expect` + mock + coverage, ít cấu hình.
- **Hệ sinh thái**: `@nestjs/testing`, `ts-jest`, `supertest` khớp NestJS.
- Snapshot, watch mode, parallel test files.

### Jest vs alternatives

| | **Jest** | Vitest | Mocha |
|---|---|---|---|
| All-in-one | ✅ | ✅ | ❌ (ghép chai + sinon...) |
| TS | qua ts-jest | native (esbuild) | qua ts-node |
| Tốc độ | Tốt | Nhanh hơn (Vite) | Tuỳ setup |
| Hệ NestJS | Chuẩn mặc định | Được | Ít phổ biến |

Dự án NestJS → **Jest** là mặc định tự nhiên (NestJS scaffold sẵn Jest).

### Vị trí trong CI/CD

```
GitHub Actions CI: npm test (jest) mỗi service đổi → PASS → mới build+push image
   FAIL → chặn build & deploy (quality gate)
```

Xem [Jest in This Project §4](./in-this-project.md).

## Practical Application

Trong ERP, Jest dùng để:
- **Unit** test domain entity + command/query handler (CQRS).
- **E2E** test API service (supertest → HTTP → app).
- **Quality gate** trong CI: fail test = chặn deploy.

## References

- [Jest Docs](https://jestjs.io/docs/getting-started) — tài liệu chính thức
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) — test NestJS
- [Testing Trophy/Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) — chiến lược test

## Related Concepts

- [Core Concepts](./core-concepts.md) — describe/it/expect/mock
- [Best Practices](./best-practices.md) — AAA, test behavior
- [Jest in This Project](./in-this-project.md) — NestJS + ts-jest
