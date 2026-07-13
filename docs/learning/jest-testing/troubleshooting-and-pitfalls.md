---
type: Reference
title: "Jest — Troubleshooting & Pitfalls"
description: "Lỗi hay gặp: flaky test, async không await, mock rò rỉ, open handle không thoát, over-mock, coverage giả, ts-jest path/prisma"
tags: [jest, troubleshooting, pitfalls, flaky, mocking, ts-jest, erp]
diataxis: reference
timestamp: "2026-07-06T10:00:00+07:00"
resource: "file://backend/auth-service/package.json"
---

# Jest — Troubleshooting & Pitfalls

> Tra cứu nhanh khi test flaky, treo, hoặc fail bí ẩn.

## 1. Async & flaky

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Test pass dù logic sai | Quên `await`/return promise | `await expect(...).resolves/rejects` |
| Test đỏ/xanh ngẫu nhiên | State/mock rò rỉ giữa test | `beforeEach` dựng lại; `afterEach` restore |
| Phụ thuộc thời gian | `Date.now()`/timer thật | `jest.useFakeTimers()`; inject clock |

## 2. Test treo / không thoát

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Jest chạy xong không thoát | Open handle (DB/Redis/HTTP chưa đóng) | Đóng kết nối `afterAll`; e2e dự án dùng `--forceExit` |
| Cảnh báo "worker process failed to exit" | Timer/socket còn treo | `--detectOpenHandles` để tìm; đóng resource |
| E2E chạy song song đè nhau | Chia sẻ DB/state | `--runInBand` (dự án dùng cho e2e) |

## 3. Mock

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Mock "dính" sang test sau | Không cleanup | `jest.restoreAllMocks()` / config `restoreMocks: true` |
| Test rỗng, không bắt bug | Over-mock (mock cả logic cần test) | Chỉ mock ranh giới (repo/Redis/Pub-Sub) |
| Không mock được module | Vị trí `jest.mock` sai | `jest.mock` ở top-level file |

## 4. ts-jest / cấu hình (đặc thù dự án)

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `Cannot find module '@erp/shared'` | `moduleNameMapper` chưa map | Map `@erp/shared` → `../shared/src`; build shared trước |
| Type error khi test | Prisma Client chưa generate | `npx prisma generate` trước test (CI làm sẵn) |
| Test service fail vì shared cũ | shared chưa build/test | Build + test `backend/shared` trước (CI làm trước) |

## 5. Coverage & giá trị

| Bẫy | Hệ quả | Tránh |
|---|---|---|
| Chạy đủ coverage nhưng assert rỗng | Coverage giả, không bắt bug | Assert hành vi thật |
| Test implementation detail | Fail khi refactor dù đúng | Test output/hành vi |
| Bỏ test đường money/domain | Bug đắt lọt lưới | Ưu tiên test rule nghiệp vụ |

## 6. Debug nhanh

```bash
# Chạy 1 file / 1 test
npx jest path/to/file.spec.ts
npx jest -t "từ chối khi vượt hạn mức"

# Tìm handle treo
npx jest --detectOpenHandles --runInBand

# Coverage
npm run test:cov
```

## Related Concepts

- [Jest in This Project](./in-this-project.md) — cấu hình + CI
- [Core Concepts](./core-concepts.md) — async, mock, hooks
- [Best Practices](./best-practices.md) — deterministic, mock ranh giới
