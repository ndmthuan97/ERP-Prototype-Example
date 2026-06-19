// =============================================================================
// REDIS CACHE SERVICE — Cache layer dùng chung (Upstash Redis REST API)
// =============================================================================
// Trước đây nằm trong customer-service. Đã rút lên @erp/shared vì 5 service
// đều cần cache giống hệt → DRY.
//
// Upstash dùng REST API (HTTP) thay vì TCP — hợp serverless/edge.
// Cache strategy: Cache-Aside (Lazy Loading).
// - GET: đọc cache trước, miss → đọc DB → ghi cache → trả về.
// - WRITE: ghi DB trước → invalidate cache (xóa key cũ).
//
// Service này còn expose getClient() (cho idempotency dùng chung 1 connection)
// và ping() (cho health check).

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';

/** TTL mặc định cho cache entries (giây) — 5 phút */
const DEFAULT_TTL_SECONDS = 300;

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  /** Upstash Redis client — REST API (HTTP). Credentials đọc từ env. */
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });

    this.logger.log('Redis Cache Service khởi tạo (Upstash REST API)');
  }

  /**
   * Trả về client Redis thô — dùng cho idempotency (withIdempotency) để
   * dùng chung 1 connection thay vì tạo client mới.
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Health check: ping Redis. Trả true nếu kết nối OK.
   * Dùng trong HealthController để báo readiness.
   */
  async ping(): Promise<boolean> {
    const pong = await this.redis.ping();
    return pong === 'PONG';
  }

  /**
   * Đọc giá trị từ cache theo key (generic T cho type-safe).
   * @returns Giá trị đã parse hoặc null nếu miss.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get<T>(key);
      return value ?? null;
    } catch (error) {
      // Cache lỗi không nên crash app — log và fallback DB
      this.logger.warn(
        `Cache GET lỗi cho key="${key}":`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Ghi giá trị vào cache với TTL (mặc định 300s).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
      await this.redis.set(key, value, { ex: ttl });
    } catch (error) {
      this.logger.warn(
        `Cache SET lỗi cho key="${key}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Xóa 1 key — dùng khi dữ liệu thay đổi (invalidate cache cũ).
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(
        `Cache DEL lỗi cho key="${key}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Xóa tất cả key khớp pattern (vd: "customers:search:*").
   * Dùng SCAN (không dùng KEYS — blocking trên Redis lớn).
   * Chỉ dùng cho invalidation sau write, không dùng trong hot path.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = 0;
      let totalDeleted = 0;

      do {
        const result = await this.redis.scan(cursor, {
          match: pattern,
          count: 100,
        });

        cursor = Number(result[0]);
        const keys = result[1];

        if (keys.length > 0) {
          await this.redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== 0);

      if (totalDeleted > 0) {
        this.logger.debug(
          `Invalidated ${totalDeleted} cache key(s) khớp pattern "${pattern}"`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Cache invalidatePattern lỗi cho pattern="${pattern}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
