// =============================================================================
// UNIT TEST — withIdempotency (@erp/shared) qua góc nhìn customer-service
// =============================================================================
// Test này cũng gián tiếp kiểm chứng link tới @erp/shared hoạt động.
// Idempotent Consumer là pattern BẮT BUỘC với Pub/Sub (at-least-once delivery).
// Dùng fake Redis (in-memory) để mô phỏng SET NX + DEL — không cần Redis thật.

import { withIdempotency } from '@erp/shared';

/**
 * Fake Upstash Redis tối giản: chỉ mô phỏng set(...NX) và del() đủ cho test.
 * set với { nx: true }: trả 'OK' nếu key chưa có, null nếu đã tồn tại.
 */
function makeFakeRedis() {
  const store = new Set<string>();
  return {
    store,
    set: jest.fn(
      async (key: string, _value: string, opts?: { nx?: boolean; ex?: number }) => {
        if (opts?.nx && store.has(key)) return null;
        store.add(key);
        return 'OK';
      },
    ),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe('withIdempotency (@erp/shared)', () => {
  it('chạy handler đúng 1 lần cho mỗi eventId (dedup)', async () => {
    const redis = makeFakeRedis();
    const handler = jest.fn().mockResolvedValue(undefined);

    const first = await withIdempotency(redis as any, 'evt-1', handler);
    const second = await withIdempotency(redis as any, 'evt-1', handler);

    expect(first).toBe(true); // lần đầu → đã xử lý
    expect(second).toBe(false); // lần 2 (trùng) → bỏ qua
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('xoá key dedup khi handler throw → cho phép redeliver/retry', async () => {
    const redis = makeFakeRedis();
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(withIdempotency(redis as any, 'evt-2', handler)).rejects.toThrow('boom');
    // Phải xoá key để Pub/Sub gửi lại được
    expect(redis.del).toHaveBeenCalledWith('processed:evt-2');

    // Sau khi key bị xoá, event xử lý lại được (không bị kẹt vĩnh viễn)
    handler.mockResolvedValue(undefined);
    const retried = await withIdempotency(redis as any, 'evt-2', handler);
    expect(retried).toBe(true);
  });
});
