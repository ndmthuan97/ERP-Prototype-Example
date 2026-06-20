// =============================================================================
// PRISMA OUTBOX STORE — Adapter Prisma cho OutboxStore (port ở @erp/shared)
// =============================================================================
// OutboxWorkerService (generic, ở @erp/shared) KHÔNG biết Prisma. Nó chỉ phụ
// thuộc interface OutboxStore. File này là "adapter" nối worker với bảng outbox
// của customer-service qua PrismaService → Dependency Inversion (SOLID "D").
//
// An toàn đa-instance: fetchUnpublished CLAIM bằng `FOR UPDATE SKIP LOCKED` +
// đặt locked_until → 2 worker không lấy trùng 1 event. markFailed tăng attempts
// và chuyển dead-letter khi vượt ngưỡng (chống retry vô hạn "poison event").

import { Injectable } from '@nestjs/common';
import type { OutboxStore, OutboxRecord } from '@erp/shared';
import { PrismaService } from './prisma.service.js';

/** Thời gian giữ khoá khi claim 1 batch (giây) — đủ để publish xong cả batch */
const LOCK_SECONDS = 30;

/** Kiểu dòng trả về từ raw claim query (snake_case từ Postgres) */
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

  /**
   * CLAIM tối đa `limit` event chưa publish (FIFO theo created_at).
   *
   * Dùng `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`:
   * - SKIP LOCKED: worker khác bỏ qua dòng đang bị 1 worker giữ → không trùng.
   * - locked_until = now()+30s: nếu worker crash sau khi claim, hết 30s dòng
   *   được claim lại (at-least-once).
   * - Loại trừ dead_lettered_at IS NOT NULL: poison event không được lấy nữa.
   */
  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "customer"."outbox"
      SET "locked_until" = now() + (${LOCK_SECONDS} * interval '1 second')
      WHERE "id" IN (
        SELECT "id" FROM "customer"."outbox"
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

  /** Đánh dấu 1 event đã publish thành công + nhả khoá. */
  async markPublished(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { publishedAt: new Date(), lockedUntil: null },
    });
  }

  /**
   * Publish thất bại: tăng attempts, lưu lastError, nhả khoá để retry.
   * attempts >= maxAttempts → set dead_lettered_at (ngừng retry).
   */
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

  /** Số event tồn đọng thật (chưa publish, chưa dead-letter) — cho gauge. */
  async countPending(): Promise<number> {
    return this.prisma.outbox.count({
      where: { publishedAt: null, deadLetteredAt: null },
    });
  }
}
