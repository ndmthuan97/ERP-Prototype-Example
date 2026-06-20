// =============================================================================
// OPTIMISTIC RETRY — Thử lại khi gặp OptimisticLockError
// =============================================================================
// Mỗi lần thử: RELOAD entity (lấy version mới) → mutate → updateWithLock.
// Nếu version lệch (2 request đua nhau) → OptimisticLockError → reload + thử lại.

import { OptimisticLockError } from '../domain/repositories/index.js';

// Đủ lớn để chịu tranh chấp N-way trên cùng 1 bản ghi (vd nhiều đơn cùng giữ
// chỗ 1 SKU). Mỗi vòng chỉ 1 writer thắng → cần ~N attempts cho N writer.
const DEFAULT_MAX_RETRIES = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withOptimisticRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        lastError = error;
        // Backoff có jitter để giảm "thundering herd" khi nhiều writer đua nhau
        await sleep(attempt * 5 + Math.floor(Math.random() * 10));
        continue; // reload + thử lại ở vòng sau
      }
      throw error;
    }
  }
  throw lastError;
}
