---
type: Concept Explanation
title: "Jest Testing Best Practices"
description: "Quy tắc 80/20: AAA pattern, test hành vi không test implementation, mock ở ranh giới, test deterministic, đặt tên rõ, test domain/CQRS trước"
tags: [jest, best-practices, aaa, testing, mocking, deterministic]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Jest Testing Best Practices

## Định nghĩa

Bộ quy tắc để test **có giá trị lâu dài**: bắt bug thật, không cản refactor, không flaky.

## Cách hoạt động

### 1. AAA — Arrange / Act / Assert

Chia mỗi test thành 3 đoạn rõ ràng:

```ts
it('trừ tồn khi đơn fulfilled', () => {
  const inv = new Inventory({ sku: 'A', qty: 10 });   // Arrange
  inv.reduce(3);                                        // Act
  expect(inv.qty).toBe(7);                              // Assert
});
```

Một test = một hành vi. Nhiều assert cho **cùng** hành vi thì OK; test 3 hành vi khác nhau → tách 3 test.

### 2. Test HÀNH VI, không test IMPLEMENTATION

> [!IMPORTANT]
> Test cái code **làm** (output/side-effect quan sát được), không phải cách nó làm (biến private, thứ tự gọi nội bộ). Test bám implementation sẽ **fail khi refactor** dù hành vi vẫn đúng → cản trở thay đổi thay vì bảo vệ.

```ts
// ❌ bám impl: kiểm gọi private helper
expect(service._calcTax).toHaveBeenCalled();
// ✅ bám hành vi: kiểm kết quả
expect(invoice.total).toBe(110);
```

### 3. Mock ở RANH GIỚI, không mock nội tâm

Mock những thứ **ngoài** đơn vị đang test: DB, Redis, Pub/Sub, HTTP ngoài. **Không** mock chính logic đang test.

```
[ Unit đang test: CommandHandler ]
   mock ──▶ Repository (DB)          ✅ ranh giới
   mock ──▶ RedisCacheService        ✅ ranh giới
   KHÔNG mock ──▶ domain entity      ❌ đó là thứ cần test thật
```

### 4. Deterministic — không phụ thuộc thời gian/ngẫu nhiên/thứ tự

| Nguồn flaky | Cách xử |
|---|---|
| `Date.now()` / `new Date()` | Inject clock hoặc `jest.useFakeTimers()` |
| `Math.random()` | Inject seed/giá trị |
| Thứ tự test | `beforeEach` dựng lại state; không share biến mutable |
| Mạng/DB thật trong unit | Mock đi |

### 5. Đặt tên test mô tả hành vi

```
✅ it('từ chối khi vượt hạn mức tín dụng')
❌ it('test checkCredit')
```

Đọc tên test = đọc đặc tả hành vi. Suite test tốt là **tài liệu sống**.

### 6. Test những gì quan trọng trước (money / domain rule / edge)

Ưu tiên test: đường **tiền/nghiệp vụ** (credit, tồn kho, đơn hàng), **edge case** (biên, rỗng, âm), **bug đã từng xảy ra** (regression). Đừng phí công test getter/setter tầm thường.

### 7. E2E cho luồng thật, unit cho logic

- **Unit** (nhiều): domain entity, command/query handler — mock repo.
- **E2E** (ít): supertest gọi API thật → kiểm hợp đồng HTTP + tích hợp.

Giữ **pyramid** (nhiều unit, ít e2e) để CI nhanh, ít flaky.

## Ví dụ thực tế (áp dụng trong dự án)

```
backend/<service>/test/domain/*.spec.ts       → unit: domain entity (rule thuần)
backend/<service>/src/application/**/*.spec.ts → unit: command/query handler (mock repo)
backend/<service>/test/*.e2e.spec.ts (jest-e2e) → e2e: API qua supertest
```

## Anti-patterns

| Anti-pattern | Hệ quả | Thay bằng |
|---|---|---|
| Test implementation detail | Fail khi refactor (dù đúng) | Test hành vi/output |
| Over-mock (mock cả logic cần test) | Test rỗng, không bắt bug | Chỉ mock ranh giới |
| Test phụ thuộc thời gian/ngẫu nhiên | Flaky | Inject clock/seed; fake timers |
| Nhiều e2e, ít unit | CI chậm, flaky | Trở về pyramid |
| Chạy đủ coverage nhưng assert rỗng | Coverage giả | Assert hành vi thật |

## Related Concepts

- [Core Concepts](./core-concepts.md) — mock/spy, async, coverage
- [Jest in This Project](./in-this-project.md) — cấu trúc DDD/CQRS
- [Overview](./overview.md) — test pyramid
