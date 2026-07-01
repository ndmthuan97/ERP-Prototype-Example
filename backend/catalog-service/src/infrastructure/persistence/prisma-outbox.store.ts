// =============================================================================
// PRISMA OUTBOX STORE — Adapter for OutboxStore (port in @erp/shared)
// =============================================================================
// Safe for multi-instance: fetchUnpublished uses FOR UPDATE SKIP LOCKED.

import { Injectable } from "@nestjs/common";
import type { OutboxStore, OutboxRecord } from "@erp/shared";
import { PrismaService } from "./prisma.service.js";

const LOCK_SECONDS = 30;

interface ClaimedRow {
  id: string;
  event_type: string;
  payload: unknown;
  aggregate_id: string;
  aggregate_type: string;
  attempts: number;
}

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "catalog"."outbox"
      SET "locked_until" = now() + (${LOCK_SECONDS} * interval '1 second')
      WHERE "id" IN (
        SELECT "id" FROM "catalog"."outbox"
        WHERE "published_at" IS NULL
          AND "dead_lettered_at" IS NULL
          AND ("locked_until" IS NULL OR "locked_until" < now())
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "event_type", "payload", "aggregate_id", "aggregate_type", "attempts";
    `;

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      attempts: Number(row.attempts),
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { publishedAt: new Date(), lockedUntil: null },
    });
  }

  async markFailed(
    id: string,
    error: string,
    maxAttempts: number,
  ): Promise<void> {
    const updated = await this.prisma.outbox.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
        lockedUntil: null,
      },
    });

    if (updated.attempts >= maxAttempts) {
      await this.prisma.outbox.update({
        where: { id },
        data: { deadLetteredAt: new Date() },
      });
    }
  }

  async countPending(): Promise<number> {
    return this.prisma.outbox.count({
      where: { publishedAt: null, deadLetteredAt: null },
    });
  }
}
