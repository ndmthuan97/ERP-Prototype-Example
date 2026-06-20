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

/** TTL của trạng thái "done" (giây) — giữ lâu để dedup mọi redelivery sau */
const DEFAULT_TTL_SECONDS = 86_400;

/**
 * TTL của trạng thái "processing" (giây) — khoá tạm trong lúc handler chạy.
 * Nếu process CRASH giữa chừng, khoá này HẾT HẠN sau PROCESSING_TTL → event
 * được redeliver xử lý lại (không bị "kẹt done" vĩnh viễn → mất event).
 */
const PROCESSING_TTL_SECONDS = 300;

/**
 * Chỉ chạy `handler` đúng 1 lần cho mỗi eventId (Idempotent Consumer).
 *
 * Cơ chế 2 trạng thái (an toàn hơn 1 cờ '1'):
 *   1. SET key='processing' NX EX 300  → claim. Không claim được = đang/đã xử lý → skip.
 *   2. handler() chạy.
 *   3a. Thành công → SET key='done' EX 86400 (giữ lâu để chặn redelivery sau).
 *   3b. Lỗi        → DEL key (cho redeliver retry NGAY).
 *
 * Vì sao tốt hơn bản cũ? Bản cũ set '1' với TTL dài NGAY trước handler — nếu crash
 * giữa chừng, key '1' tồn tại 1 ngày → event không bao giờ được xử lý lại (mất).
 * Bản này dùng khoá 'processing' TTL ngắn → crash thì tự hết hạn, an toàn.
 *
 * @returns true nếu handler ĐÃ chạy (lần đầu); false nếu đã xử lý/đang xử lý (skip).
 */
export async function withIdempotency(
  redis: Redis,
  eventId: string,
  handler: () => Promise<void>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const key = `processed:${eventId}`;

  // Claim: 'OK' nếu set được (lần đầu), null nếu key đã tồn tại ('processing' hoặc 'done')
  const claimed = await redis.set(key, 'processing', {
    nx: true,
    ex: PROCESSING_TTL_SECONDS,
  });
  if (claimed !== 'OK') {
    // Đã/đang xử lý → bỏ qua, KHÔNG chạy handler lần 2
    return false;
  }

  try {
    await handler();
    // Chuyển sang 'done' với TTL dài để chặn mọi redelivery về sau
    await redis.set(key, 'done', { ex: ttlSeconds });
    return true;
  } catch (error) {
    // Xử lý thất bại → xoá key để cho phép redeliver + retry ngay
    await redis.del(key);
    throw error;
  }
}
