// =============================================================================
// REDIS CACHE SERVICE — Cache layer sử dụng Upstash Redis (REST API)
// =============================================================================
// Upstash Redis cung cấp REST API — không cần TCP connection như Redis truyền thống.
// Phù hợp cho serverless và edge deployment (Cloudflare Workers, Vercel Edge...).
//
// Cache layer giúp:
// 1. Giảm tải database — read queries thường xuyên lấy từ cache
// 2. Tăng tốc response time — Redis ~1ms vs PostgreSQL ~10-50ms
// 3. Giảm chi phí Supabase — ít query = ít tốn bandwidth
//
// Cache strategy: Cache-Aside (Lazy Loading)
// - GET: đọc cache trước, nếu miss → đọc DB → ghi vào cache → trả về
// - WRITE: ghi DB trước → invalidate cache (xóa key cũ)
// - TTL mặc định 5 phút — balance giữa freshness và performance

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';

/** TTL mặc định cho cache entries (giây) — 5 phút */
const DEFAULT_TTL_SECONDS = 300;

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  /**
   * Upstash Redis client — sử dụng REST API (HTTP) thay vì TCP.
   * Credentials đọc từ env: UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN.
   */
  private readonly redis: Redis;

  constructor() {
    // Khởi tạo client với URL và token từ environment variables
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });

    this.logger.log('Redis Cache Service khởi tạo (Upstash REST API)');
  }

  /**
   * Đọc giá trị từ cache theo key.
   * Generic type T để caller chỉ định kiểu trả về (type-safe).
   *
   * @param key - Cache key (vd: "customer:uuid-123")
   * @returns Giá trị đã parse hoặc null nếu cache miss
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Upstash tự động parse JSON khi get — trả về object thay vì string
      const value = await this.redis.get<T>(key);
      return value ?? null;
    } catch (error) {
      // Cache error không nên làm crash app — log và trả null (fallback DB)
      this.logger.warn(
        `Cache GET lỗi cho key="${key}":`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Ghi giá trị vào cache với TTL tùy chọn.
   *
   * @param key          - Cache key
   * @param value        - Giá trị cần cache (sẽ được serialize thành JSON)
   * @param ttlSeconds   - Thời gian sống (giây), mặc định 300s (5 phút)
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;

      // SET key value EX ttl — tự động hết hạn sau ttl giây
      await this.redis.set(key, value, { ex: ttl });
    } catch (error) {
      // Cache error không critical — app vẫn hoạt động bình thường qua DB
      this.logger.warn(
        `Cache SET lỗi cho key="${key}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Xóa 1 key khỏi cache.
   * Dùng khi dữ liệu thay đổi (create/update/delete) → invalidate cache cũ.
   *
   * @param key - Cache key cần xóa
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
   * Xóa tất cả key khớp pattern.
   * Dùng khi cần invalidate nhiều key cùng lúc.
   *
   * Ví dụ: invalidatePattern("customer:*") → xóa tất cả cache khách hàng.
   *
   * Lưu ý: SCAN + DEL có thể chậm nếu có nhiều key.
   * Chỉ dùng cho invalidation sau write, không dùng trong hot path.
   *
   * @param pattern - Glob pattern (vd: "customer:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Dùng SCAN để tìm key khớp pattern — tránh KEYS (blocking trên Redis lớn)
      let cursor = 0;
      let totalDeleted = 0;

      do {
        // SCAN trả về [cursor, keys] — iterate cho đến khi cursor = 0
        const result = await this.redis.scan(cursor, {
          match: pattern,
          count: 100,
        });

        cursor = Number(result[0]);
        const keys = result[1];

        // Xóa các key tìm được trong batch này
        if (keys.length > 0) {
          await this.redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== 0);

      if (totalDeleted > 0) {
        this.logger.debug(
          `Invalidated ${totalDeleted} cache key(s) matching pattern "${pattern}"`,
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
