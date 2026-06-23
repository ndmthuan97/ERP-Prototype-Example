// =============================================================================
// IDEMPOTENCY HELPER TESTS — withIdempotency() 2-state dedup pattern
// =============================================================================
// Tests verify the core guarantee: handler runs AT MOST ONCE per eventId,
// even with concurrent calls or crashes mid-processing.

import { withIdempotency } from './idempotency';

// ---------------------------------------------------------------------------
// Mock Redis — minimal implementation matching @upstash/redis API surface
// ---------------------------------------------------------------------------
function createMockRedis() {
  const store = new Map<string, string>();

  return {
    store,
    set: jest.fn(
      async (
        key: string,
        value: string,
        opts?: { nx?: boolean; ex?: number },
      ) => {
        if (opts?.nx && store.has(key)) return null; // NX: key exists → fail
        store.set(key, value);
        return 'OK';
      },
    ),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

type MockRedis = ReturnType<typeof createMockRedis>;

describe('withIdempotency', () => {
  let redis: MockRedis;
  let handler: jest.Mock;

  beforeEach(() => {
    redis = createMockRedis();
    handler = jest.fn().mockResolvedValue(undefined);
  });

  it('should run handler on first call and return true', async () => {
    const result = await withIdempotency(redis as any, 'evt-1', handler);

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should set "processing" then "done" on success', async () => {
    await withIdempotency(redis as any, 'evt-1', handler);

    // First SET call: 'processing' with NX
    expect(redis.set).toHaveBeenCalledWith('processed:evt-1', 'processing', {
      nx: true,
      ex: 300,
    });
    // Second SET call: 'done' with long TTL
    expect(redis.set).toHaveBeenCalledWith('processed:evt-1', 'done', {
      ex: 86_400,
    });
  });

  it('should skip handler on duplicate eventId and return false', async () => {
    // First call — claims the key
    await withIdempotency(redis as any, 'evt-1', handler);
    handler.mockClear();

    // Second call — key already exists ('done') → NX fails
    const result = await withIdempotency(redis as any, 'evt-1', handler);

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should delete key on handler failure to allow retry', async () => {
    const error = new Error('Handler crashed');
    handler.mockRejectedValueOnce(error);

    await expect(
      withIdempotency(redis as any, 'evt-1', handler),
    ).rejects.toThrow('Handler crashed');

    // Key should be deleted → next redeliver can retry
    expect(redis.del).toHaveBeenCalledWith('processed:evt-1');
    expect(redis.store.has('processed:evt-1')).toBe(false);
  });

  it('should allow retry after handler failure (key deleted)', async () => {
    // First call — handler fails → key deleted
    handler.mockRejectedValueOnce(new Error('fail'));
    await expect(
      withIdempotency(redis as any, 'evt-1', handler),
    ).rejects.toThrow();

    // Second call — handler succeeds (retry)
    handler.mockResolvedValueOnce(undefined);
    const result = await withIdempotency(redis as any, 'evt-1', handler);

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(redis.store.get('processed:evt-1')).toBe('done');
  });

  it('should use custom TTL when provided', async () => {
    await withIdempotency(redis as any, 'evt-1', handler, 3600);

    expect(redis.set).toHaveBeenCalledWith('processed:evt-1', 'done', {
      ex: 3600,
    });
  });

  it('should handle independent eventIds separately', async () => {
    await withIdempotency(redis as any, 'evt-1', handler);
    await withIdempotency(redis as any, 'evt-2', handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(redis.store.get('processed:evt-1')).toBe('done');
    expect(redis.store.get('processed:evt-2')).toBe('done');
  });
});
