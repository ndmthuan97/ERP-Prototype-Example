// =============================================================================
// PRISMA OUTBOX STORE — Adapter Prisma cho OutboxStore (port ở @erp/shared)
// =============================================================================
// OutboxWorkerService (generic, ở @erp/shared) KHÔNG biết Prisma. Nó chỉ phụ
// thuộc interface OutboxStore. File này là "adapter" nối worker với bảng outbox
// của customer-service qua PrismaService → Dependency Inversion (SOLID "D").
//
// Mỗi service sau này (Order, Inventory...) chỉ cần copy 1 file mỏng như thế này
// (đổi prisma model), còn toàn bộ logic poll/publish/retry dùng chung từ shared.

import { Injectable } from '@nestjs/common';
import type { OutboxStore, OutboxRecord } from '@erp/shared';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy các event chưa publish (published_at IS NULL), FIFO theo created_at.
   * Chuẩn hoá Prisma record → OutboxRecord (kiểu chung của shared).
   */
  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      payload: row.payload,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
    }));
  }

  /**
   * Đánh dấu 1 event đã publish thành công.
   */
  async markPublished(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }
}
