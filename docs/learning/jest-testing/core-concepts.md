---
type: Concept Explanation
title: "Jest Core Concepts"
description: "Building blocks: describe/it, expect & matchers, setup/teardown hooks, mock & spy, async testing, test doubles, coverage"
tags: [jest, describe, expect, mock, spy, async, coverage]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Jest Core Concepts

## Định nghĩa

Jest xây trên vài khái niệm cốt lõi. Nắm chúng = viết được test đọc rõ, cô lập, không flaky.

## Tại sao quan trọng

Không hiểu async test → test pass giả (không await). Không hiểu mock cleanup → test rò rỉ, flaky. Không hiểu matcher → assertion yếu.

## Cách hoạt động

### 1. `describe` / `it` (`test`) — cấu trúc

```ts
describe('CreateCustomerCommand', () => {
  it('tạo customer khi input hợp lệ', () => {
    // ...
  });
  it('ném lỗi khi email trùng', () => {
    // ...
  });
});
```

`describe` nhóm; `it`/`test` là một ca kiểm thử. Tên nên mô tả **hành vi**, không mô tả hàm.

### 2. `expect` & Matchers — khẳng định

```ts
expect(result).toBe(42);              // === (primitive)
expect(obj).toEqual({ id: 1 });       // deep equal
expect(fn).toThrow('duplicate');      // ném lỗi
expect(arr).toHaveLength(3);
expect(spy).toHaveBeenCalledWith(x);  // mock được gọi đúng
```

### 3. Setup / Teardown hooks

```ts
beforeEach(() => { /* dựng state sạch mỗi test */ });
afterEach(() => { jest.restoreAllMocks(); });   // dọn mock
beforeAll(() => { /* 1 lần trước cả suite */ });
afterAll(() => { /* đóng kết nối */ });
```

> [!IMPORTANT]
> `beforeEach` dựng state **mới mỗi test** → test cô lập, không phụ thuộc thứ tự. `afterEach` dọn mock để không **rò rỉ** sang test sau.

### 4. Mock & Spy — cô lập phụ thuộc

| Công cụ | Dùng cho |
|---|---|
| `jest.fn()` | Hàm giả, kiểm được gọi thế nào |
| `jest.spyOn(obj, 'm')` | Theo dõi/ghi đè method thật |
| `jest.mock('module')` | Thay cả module (vd repository, Redis client) |

```ts
const repo = { save: jest.fn().mockResolvedValue({ id: 1 }) };
await handler.execute(cmd, repo);
expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.c' }));
```

### 5. Async testing — bẫy phổ biến nhất

```ts
it('async đúng cách', async () => {
  await expect(handler.execute(cmd)).resolves.toEqual(...);
  await expect(handler.execute(bad)).rejects.toThrow('duplicate');
});
```

> [!WARNING]
> **Quên `await`/`return` promise = test pass giả.** Assertion chạy sau khi test đã "kết thúc" → lỗi không được bắt. Luôn `await` (hoặc return) promise trong test async.

### 6. Test doubles (dummy/stub/mock/fake)

| Loại | Ý nghĩa |
|---|---|
| Stub | Trả giá trị định sẵn |
| Mock | Kiểm **tương tác** (được gọi đúng không) |
| Fake | Bản cài đơn giản (in-memory repo) |

### 7. Coverage

`jest --coverage` đo % dòng/nhánh được test chạm.

> [!TIP]
> Coverage là **tín hiệu**, không phải mục tiêu. 100% coverage vẫn có thể test rỗng (chạm code nhưng không assert đúng). Ưu tiên test **hành vi quan trọng** (money, domain rule) hơn là chạy đủ số.

## Ví dụ thực tế

```ts
describe('CheckCreditQuery', () => {
  let repo: { getBalance: jest.Mock };
  beforeEach(() => { repo = { getBalance: jest.fn() }; });

  it('cho phép khi còn hạn mức', async () => {
    repo.getBalance.mockResolvedValue(500);          // Arrange
    const ok = await new CheckCreditQuery(repo).execute({ customerId: 1, amount: 300 }); // Act
    expect(ok).toBe(true);                            // Assert
  });

  it('từ chối khi vượt hạn mức', async () => {
    repo.getBalance.mockResolvedValue(100);
    await expect(new CheckCreditQuery(repo).execute({ customerId: 1, amount: 300 }))
      .resolves.toBe(false);
  });
});
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Test pass giả | Quên `await` promise | `await expect(...).resolves/rejects` |
| Test flaky theo thứ tự | State/mock rò rỉ giữa test | `beforeEach` dựng lại; `afterEach` restore mock |
| Mock không reset | Không cleanup | `jest.restoreAllMocks()` / config `clearMocks` |
| Assertion yếu | Chỉ `toBeTruthy()` | Dùng matcher cụ thể (`toEqual`, `toThrow`) |

## Related Concepts

- [Overview](./overview.md) — test pyramid
- [Best Practices](./best-practices.md) — AAA, test behavior
- [Jest in This Project](./in-this-project.md) — cấu hình + cấu trúc DDD
