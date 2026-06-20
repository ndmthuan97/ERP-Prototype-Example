// =============================================================================
// HEALTH CHECK — Endpoint /health báo readiness/liveness của service
// =============================================================================
// Mỗi service cần biết các dependency (DB, Redis, Pub/Sub) có sống không.
// Orchestrator (Docker/K8s) hoặc người dev `curl /health` để kiểm tra.
//
// Dependency Inversion: HealthController KHÔNG biết Prisma/Redis cụ thể. Service
// tự đăng ký 1 mảng HealthIndicator (mỗi cái 1 hàm check) qua token HEALTH_INDICATORS.
// → Controller dùng được với mọi service mà không cần biết chi tiết.
//
// Dùng custom thay vì @nestjs/terminus để: zero dependency, minh bạch cho việc học,
// không bị khoá vào API version của terminus. Logic ngắn, dễ đọc.

import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

/** 1 mục kiểm tra sức khoẻ (vd: 'postgres', 'redis') */
export interface HealthIndicator {
  /** Tên hiển thị trong kết quả */
  name: string;
  /** Trả true nếu khoẻ; throw hoặc trả false nếu hỏng */
  check(): Promise<boolean>;
}

/** DI token: service bind mảng HealthIndicator vào đây */
export const HEALTH_INDICATORS = Symbol('HEALTH_INDICATORS');

/** Timeout cho mỗi health check (ms) — tránh /health treo khi 1 dependency hang */
const CHECK_TIMEOUT_MS = 3_000;

/** Bọc 1 promise với timeout — reject nếu quá hạn (coi như check hỏng). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('health check timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

@Controller()
export class HealthController {
  constructor(
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: HealthIndicator[],
  ) {}

  /**
   * GET /health/live — LIVENESS: process còn sống? (không kiểm tra dependency)
   * Dùng cho restart policy của orchestrator — không phụ thuộc DB/Redis để tránh
   * restart-loop khi dependency tạm chập (đó là việc của readiness).
   */
  @Get('health/live')
  live(): { status: 'ok'; time: string } {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /**
   * GET /health (READINESS) — chạy tất cả indicator song song (có timeout).
   * Tất cả OK → 200 { status: 'ok' }. Có cái hỏng → 503 { status: 'down' }.
   */
  @Get('health')
  async health(): Promise<HealthResponse> {
    const checks = await Promise.all(
      this.indicators.map(async (indicator) => {
        try {
          const ok = await withTimeout(indicator.check(), CHECK_TIMEOUT_MS);
          return { name: indicator.name, ok };
        } catch {
          // Check throw/timeout (vd: DB hang) → coi như hỏng, không làm treo endpoint
          return { name: indicator.name, ok: false };
        }
      }),
    );

    const allOk = checks.every((c) => c.ok);
    const body: HealthResponse = {
      status: allOk ? 'ok' : 'down',
      time: new Date().toISOString(),
      checks,
    };

    // Trả 503 khi có dependency hỏng → orchestrator biết để không route traffic
    if (!allOk) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }
}

/** Kết quả trả về của /health */
export interface HealthResponse {
  status: 'ok' | 'down';
  time: string;
  checks: { name: string; ok: boolean }[];
}
