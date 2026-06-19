// =============================================================================
// CORRELATION ID — Truy vết 1 luồng nghiệp vụ xuyên nhiều service
// =============================================================================
// Vấn đề: saga chạy qua 4 service. Khi 1 order fail, làm sao biết log nào của
// 4 service thuộc cùng 1 order? → Gắn mỗi request/luồng 1 correlationId duy nhất.
//
// Cách làm: AsyncLocalStorage (ALS) — "biến toàn cục theo ngữ cảnh async".
// Mỗi request chạy trong 1 "store" riêng chứa correlationId; mọi code async
// bên trong (kể cả logger) đọc được id đó mà KHÔNG cần truyền tay qua từng hàm.
//
// Lan truyền xuyên service:
// - HTTP: middleware đọc header x-correlation-id (gateway sinh ra), hoặc tự sinh.
// - Event: ghi correlationId vào outbox payload (_meta) → subscriber đọc ra,
//   gọi runWithCorrelation() để tiếp tục chuỗi → grep 1 id thấy cả saga.

import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Dữ liệu lưu theo ngữ cảnh mỗi request/luồng */
interface CorrelationStore {
  correlationId: string;
}

/** Tên header HTTP mang correlationId giữa các service */
export const CORRELATION_HEADER = 'x-correlation-id';

/** Kho lưu trữ theo ngữ cảnh async — 1 instance dùng chung toàn process */
const storage = new AsyncLocalStorage<CorrelationStore>();

/** Lấy correlationId của ngữ cảnh hiện tại (undefined nếu ngoài request) */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Chạy `fn` bên trong 1 ngữ cảnh có correlationId cho trước.
 * Dùng ở event subscriber: đọc correlationId từ event rồi bọc handler.
 */
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/**
 * Middleware HTTP: lấy correlationId từ header (nếu có) hoặc sinh mới,
 * gắn vào response header, rồi chạy phần còn lại của request trong ngữ cảnh đó.
 *
 * req/res để kiểu `any` để shared không phải phụ thuộc @types/express.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const incoming = req?.headers?.[CORRELATION_HEADER];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

    // Trả id về client/gateway để truy vết đầu-cuối
    if (res && typeof res.setHeader === 'function') {
      res.setHeader(CORRELATION_HEADER, correlationId);
    }

    // Toàn bộ xử lý request sau đây nằm trong ngữ cảnh có correlationId
    storage.run({ correlationId }, () => next());
  }
}
