// =============================================================================
// SESSION SERVICE — Server-side session whitelist (instant revoke + idle bound)
// =============================================================================
// One row per active login. Redis `session:<sid>` is the hot-path whitelist the
// gateway checks on every request (FR-A13 instant revoke); the Postgres row is
// the durable record used to enumerate + revoke ALL of a user's sessions and to
// bound idle lifetime (FR-A9, `expiresAt`). TTL = idle window in seconds.
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import { RedisCacheService } from '@erp/shared';
import { PrismaService } from '../persistence/prisma.service.js';

/** Payload cached under `session:<sid>` — kept minimal for the gateway check. */
interface SessionCacheValue {
  userId: string;
  role: string;
}

const REDIS_KEY_PREFIX = 'session:';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisCacheService,
  ) {}

  /** Idle window (seconds) for a role, from env; falls back to the default. */
  private idleSecondsFor(role: string): number {
    const def = Number.parseInt(process.env.SESSION_IDLE_MIN_DEFAULT ?? '', 10);
    const defaultMin = Number.isNaN(def) ? 30 : def;

    const overrideEnv: Record<string, string | undefined> = {
      admin: process.env.SESSION_IDLE_MIN_ADMIN,
      manager: process.env.SESSION_IDLE_MIN_MANAGER,
      staff: process.env.SESSION_IDLE_MIN_STAFF,
    };
    const raw = overrideEnv[role];
    const override = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
    const minutes = Number.isNaN(override) ? defaultMin : override;

    return minutes * 60;
  }

  private key(sid: string): string {
    return REDIS_KEY_PREFIX + sid;
  }

  /** Create a session: persist the row + whitelist it in Redis with idle TTL. */
  async create(params: {
    userId: string;
    role: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ sid: string }> {
    const { userId, role, ip, userAgent } = params;
    const idleSec = this.idleSecondsFor(role);
    const sid = v4();

    // Opportunistically prune this user's expired rows so the table doesn't grow
    // unbounded (Redis keys already self-expire via TTL).
    await this.prisma.session.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    await this.prisma.session.create({
      data: {
        id: sid,
        userId,
        expiresAt: new Date(Date.now() + idleSec * 1000),
        ip,
        userAgent,
      },
    });

    const value: SessionCacheValue = { userId, role };
    await this.redis.set(this.key(sid), value, idleSec);

    return { sid };
  }

  /** Revoke a single session (logout). */
  async revoke(sid: string): Promise<void> {
    await this.redis.del(this.key(sid));
    await this.prisma.session.deleteMany({ where: { id: sid } });
  }

  /** Revoke ALL sessions for a user (deactivation — FR-A13). */
  async revokeAllForUser(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });
    for (const { id } of sessions) {
      await this.redis.del(this.key(id));
    }
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
