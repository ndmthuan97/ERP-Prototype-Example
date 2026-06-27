// =============================================================================
// PRISMA STOCK ITEM REPOSITORY — Optimistic Locking + Outbox
// =============================================================================
// Điểm nhấn: updateWithLock dùng `updateMany WHERE id + version` → nếu 0 row
// (version đã bị transaction khác đổi) → ném OptimisticLockError để command retry.
// Event ghi vào outbox CÙNG transaction (Outbox Pattern).

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { StockItem } from '../../domain/entities/index.js';
import {
  IStockItemRepository,
  OptimisticLockError,
  type OutboxEventInput,
  type PaginatedResult,
  type StockMovementInput,
} from '../../domain/repositories/index.js';
import { PrismaService } from './prisma.service.js';
import { getCorrelationId } from '@erp/shared';

/** Metadata truy vết đính kèm event (correlationId xuyên saga) */
function buildEventMeta() {
  return {
    correlationId: getCorrelationId() ?? null,
    occurredAt: new Date().toISOString(),
  };
}

type StockItemRecord = {
  id: string;
  sku: string;
  name: string;
  quantityAvailable: Prisma.Decimal;
  quantityReserved: Prisma.Decimal;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaStockItemRepository implements IStockItemRepository {
  private readonly logger = new Logger(PrismaStockItemRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDomain(record: StockItemRecord): StockItem {
    return new StockItem({
      id: record.id,
      sku: record.sku,
      name: record.name,
      quantityAvailable: record.quantityAvailable.toNumber(),
      quantityReserved: record.quantityReserved.toNumber(),
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private buildOutboxData(item: StockItem, event: OutboxEventInput) {
    return {
      id: uuidv4(),
      aggregateType: 'StockItem',
      aggregateId: item.id,
      eventType: event.eventType,
      payload: {
        ...event.payload,
        _meta: buildEventMeta(),
      } as Prisma.InputJsonObject,
    };
  }

  async findById(id: string): Promise<StockItem | null> {
    const record = await this.prisma.stockItem.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySku(sku: string): Promise<StockItem | null> {
    const record = await this.prisma.stockItem.findUnique({ where: { sku } });
    return record ? this.toDomain(record) : null;
  }

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<StockItem>> {
    const where: Prisma.StockItemWhereInput = query
      ? { name: { contains: query, mode: 'insensitive' as const } }
      : {};
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.stockItem.count({ where }),
      this.prisma.stockItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page,
      limit,
    };
  }

  async create(item: StockItem, event?: OutboxEventInput): Promise<StockItem> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const rec = await tx.stockItem.create({
          data: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            quantityAvailable: item.quantityAvailable,
            quantityReserved: item.quantityReserved,
            version: 0,
          },
        });
        if (event) {
          await tx.outbox.create({ data: this.buildOutboxData(item, event) });
        }
        return rec;
      });
      this.logger.log(`StockItem created: sku="${created.sku}"`);
      return this.toDomain(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`SKU "${item.sku}" đã tồn tại`);
      }
      throw error;
    }
  }

  async updateWithLock(
    item: StockItem,
    event?: OutboxEventInput,
  ): Promise<StockItem> {
    return this.prisma.$transaction(async (tx) => {
      // Optimistic lock: chỉ update khi version DB == version entity, đồng thời +1
      const res = await tx.stockItem.updateMany({
        where: { id: item.id, version: item.version },
        data: {
          name: item.name,
          quantityAvailable: item.quantityAvailable,
          quantityReserved: item.quantityReserved,
          version: { increment: 1 },
          updatedAt: item.updatedAt,
        },
      });

      if (res.count === 0) {
        // version lệch → 1 transaction khác đã ghi đè → để command retry
        throw new OptimisticLockError(item.id);
      }

      if (event) {
        await tx.outbox.create({ data: this.buildOutboxData(item, event) });
      }

      const updated = await tx.stockItem.findUniqueOrThrow({
        where: { id: item.id },
      });
      return this.toDomain(updated);
    });
  }

  async saveWithMovement(
    item: StockItem,
    movement: StockMovementInput,
    event?: OutboxEventInput,
  ): Promise<StockItem> {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.stockItem.updateMany({
        where: { id: item.id, version: item.version },
        data: {
          name: item.name,
          quantityAvailable: item.quantityAvailable,
          quantityReserved: item.quantityReserved,
          version: { increment: 1 },
          updatedAt: item.updatedAt,
        },
      });

      if (res.count === 0) {
        throw new OptimisticLockError(item.id);
      }

      await tx.stockMovement.create({
        data: {
          itemId: movement.itemId,
          type: movement.type,
          quantity: movement.quantity,
          reason: movement.reason,
          reference: movement.reference ?? null,
        },
      });

      if (event) {
        await tx.outbox.create({ data: this.buildOutboxData(item, event) });
      }

      const updated = await tx.stockItem.findUniqueOrThrow({
        where: { id: item.id },
      });
      this.logger.log(
        `StockItem ${movement.type}: sku="${item.sku}" qty=${movement.quantity} reason="${movement.reason}"`,
      );
      return this.toDomain(updated);
    });
  }

  async createOutboxEvent(event: OutboxEventInput): Promise<void> {
    const orderId = (event.payload as Record<string, unknown>).orderId;
    await this.prisma.outbox.create({
      data: {
        id: uuidv4(),
        aggregateType: 'StockItem',
        aggregateId: typeof orderId === 'string' ? orderId : 'unknown',
        eventType: event.eventType,
        payload: {
          ...event.payload,
          _meta: buildEventMeta(),
        } as Prisma.InputJsonObject,
      },
    });
  }
}
