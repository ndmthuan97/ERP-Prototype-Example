// =============================================================================
// IDEMPOTENCY HELPER — Idempotent Consumer pattern (BẮT BUỘC với Pub/Sub)
// =============================================================================
// Pub/Sub là at-least-once: CÙNG 1 message có thể đến >1 lần.
// Nếu consumer không dedup → xử lý trùng (vd: reserve gấp đôi tồn kho).
//
// Cách dedup: dùng Upstash Redis làm "processed store".
//   SET processed:<eventId> '1' NX EX 86400
//   - NX  → chỉ set nếu key CHƯA tồn tại → trả 'OK' nếu lần đầu, null nếu đã có.
//   - EX  → tự hết hạn sau 1 ngày (không phình Redis vô hạn).
//
// Bọc mọi handler bằng withIdempotency() thay vì viết lại logic SET NX mỗi nơi.

import { Redis } from '@upstash/redis';

/** TTL mặc định cho key dedup (giây) — 1 ngày */
const DEFAULT_TTL_SECONDS = 86_400;

/**
 * Chỉ chạy `handler` đúng 1 lần cho mỗi eventId.
 *
 * @returns true  nếu đây là lần đầu (handler ĐÃ chạy)
 *          false nếu event đã xử lý trước đó (handler BỎ QUA)
 *
 * Nếu handler throw → xoá key dedup để Pub/Sub redeliver được (cho retry).
 */
export async function withIdempotency(
  redis: Redis,
  eventId: string,
  handler: () => Promise<void>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const key = `processed:${eventId}`;

  // SET ... NX: 'OK' nếu set được (lần đầu), null nếu key đã tồn tại
  const fresh = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  if (fresh !== 'OK') {
    // Đã xử lý rồi → bỏ qua, KHÔNG chạy handler lần 2
    return false;
  }

  try {
    await handler();
    return true;
  } catch (error) {
    // Xử lý thất bại → xoá key để cho phép redeliver + retry
    await redis.del(key);
    throw error;
  }
}
