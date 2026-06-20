// =============================================================================
// PRISMA ORDER REPOSITORY — Implementation (Infrastructure Layer)
// =============================================================================
// Aggregate Root persistence: OrderHeader luôn load/save cùng lines.
// Mọi thay đổi (update, addLine) đều trong transaction + outbox + status_history
// + lifecycle_view (CQRS read model).
// Decimal ↔ number conversion happens at this boundary only.

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type OrderHeader as PrismaOrderHeader, type OrderLine as PrismaOrderLine } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { OrderHeader, OrderLine } from '../../domain/entities/index.js';
import {
  type IOrderRepository,
  type OutboxEventInput,
  type StatusHistoryInput,
  type StatusHistoryEntry,
  type LifecycleViewData,
  type PaginatedResult,
  type SearchOrdersParams,
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

@Injectable()
export class PrismaOrderRepository implements IOrderRepository {
  private readonly logger = new Logger(PrismaOrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // MAPPING: Prisma record ↔ Domain entity (Decimal → number at boundary)
  // ==========================================================================

  private toDomain(
    record: PrismaOrderHeader & { lines?: PrismaOrderLine[] },
  ): OrderHeader {
    const lines = (record.lines ?? []).map(
      (l) =>
        new OrderLine({
          id: l.id,
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
          createdAt: l.createdAt,
        }),
    );

    return new OrderHeader({
      id: record.id,
      customerId: record.customerId,
      status: record.status as OrderHeader['status'],
      totalAmount: Number(record.totalAmount),
      cancelReason: record.cancelReason,
      version: record.version,
      lines,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private buildOutboxData(order: OrderHeader, event: OutboxEventInput) {
    return {
      id: uuidv4(),
      aggregateType: 'Order',
      aggregateId: order.id,
      eventType: event.eventType,
      payload: {
        ...event.payload,
        _meta: buildEventMeta(),
      } as Prisma.InputJsonObject,
    };
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  async findById(id: string): Promise<OrderHeader | null> {
    const record = await this.prisma.orderHeader.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByIdWithLines(id: string): Promise<OrderHeader | null> {
    const record = await this.prisma.orderHeader.findUnique({
      where: { id },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async search(params: SearchOrdersParams): Promise<PaginatedResult<OrderHeader>> {
    const where: Prisma.OrderHeaderWhereInput = params.status
      ? { status: params.status }
      : {};
    const skip = (params.page - 1) * params.limit;

    const [total, records] = await Promise.all([
      this.prisma.orderHeader.count({ where }),
      this.prisma.orderHeader.findMany({
        where,
        include: { lines: true },
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async getLifecycle(orderId: string): Promise<StatusHistoryEntry[]> {
    const entries = await this.prisma.statusHistory.findMany({
      where: { headerId: orderId },
      orderBy: { changedAt: 'asc' },
    });
    return entries.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      changedBy: e.changedBy,
      changedAt: e.changedAt,
      reason: e.reason,
    }));
  }

  // ==========================================================================
  // MUTATIONS (all transactional)
  // ==========================================================================

  async create(order: OrderHeader, event?: OutboxEventInput): Promise<OrderHeader> {
    const created = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.orderHeader.create({
        data: {
          id: order.id,
          customerId: order.customerId,
          status: order.status,
          totalAmount: order.totalAmount,
          cancelReason: order.cancelReason,
          version: 0,
        },
      });

      // Ghi status_history entry đầu tiên (null → draft)
      await tx.statusHistory.create({
        data: {
          id: uuidv4(),
          headerId: order.id,
          fromStatus: null,
          toStatus: 'draft',
          changedBy: 'system',
        },
      });

      // Upsert lifecycle_view
      await tx.lifecycleView.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          customerName: '',
          status: 'draft',
          totalAmount: order.totalAmount,
          lineCount: 0,
          createdAt: order.createdAt,
          lastStatusChange: new Date(),
        },
        update: {
          status: 'draft',
          lastStatusChange: new Date(),
        },
      });

      if (event) {
        await tx.outbox.create({ data: this.buildOutboxData(order, event) });
      }
      return rec;
    });

    this.logger.log(`Order created: id="${created.id}", customer="${created.customerId}"`);
    return this.toDomain(created);
  }

  async addLine(
    order: OrderHeader,
    lifecycleData?: LifecycleViewData,
  ): Promise<OrderHeader> {
    // Lấy line cuối cùng vừa thêm vào entity (đã add qua OrderHeader.addLine)
    const lastLine = order.lines[order.lines.length - 1];

    const updated = await this.prisma.$transaction(async (tx) => {
      // Insert line mới
      await tx.orderLine.create({
        data: {
          id: lastLine.id,
          headerId: order.id,
          itemId: lastLine.itemId,
          itemName: lastLine.itemName,
          quantity: lastLine.quantity,
          unitPrice: lastLine.unitPrice,
          lineTotal: lastLine.lineTotal,
        },
      });

      // Update header totalAmount + version
      const rec = await tx.orderHeader.update({
        where: { id: order.id },
        data: {
          totalAmount: order.totalAmount,
          version: { increment: 1 },
          updatedAt: order.updatedAt,
        },
        include: { lines: { orderBy: { createdAt: 'asc' } } },
      });

      // Update lifecycle_view
      if (lifecycleData) {
        await tx.lifecycleView.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            customerName: lifecycleData.customerName,
            status: lifecycleData.status,
            totalAmount: lifecycleData.totalAmount,
            lineCount: lifecycleData.lineCount,
            createdAt: lifecycleData.createdAt,
            lastStatusChange: lifecycleData.lastStatusChange,
          },
          update: {
            totalAmount: lifecycleData.totalAmount,
            lineCount: lifecycleData.lineCount,
          },
        });
      }

      return rec;
    });

    return this.toDomain(updated);
  }

  async update(
    order: OrderHeader,
    events?: OutboxEventInput[],
    statusEntry?: StatusHistoryInput,
    lifecycleData?: LifecycleViewData,
  ): Promise<OrderHeader> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.orderHeader.update({
        where: { id: order.id },
        data: {
          status: order.status,
          totalAmount: order.totalAmount,
          cancelReason: order.cancelReason,
          version: { increment: 1 },
          updatedAt: order.updatedAt,
        },
        include: { lines: { orderBy: { createdAt: 'asc' } } },
      });

      // Ghi status_history
      if (statusEntry) {
        await tx.statusHistory.create({
          data: {
            id: uuidv4(),
            headerId: order.id,
            fromStatus: statusEntry.fromStatus,
            toStatus: statusEntry.toStatus,
            changedBy: statusEntry.changedBy,
            reason: statusEntry.reason,
          },
        });
      }

      // Upsert lifecycle_view (CQRS read model)
      if (lifecycleData) {
        await tx.lifecycleView.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            customerName: lifecycleData.customerName,
            status: lifecycleData.status,
            totalAmount: lifecycleData.totalAmount,
            lineCount: lifecycleData.lineCount,
            createdAt: lifecycleData.createdAt,
            lastStatusChange: lifecycleData.lastStatusChange,
          },
          update: {
            status: lifecycleData.status,
            totalAmount: lifecycleData.totalAmount,
            lineCount: lifecycleData.lineCount,
            lastStatusChange: lifecycleData.lastStatusChange,
          },
        });
      }

      // Ghi outbox events
      if (events && events.length > 0) {
        for (const event of events) {
          await tx.outbox.create({ data: this.buildOutboxData(order, event) });
        }
      }

      return rec;
    });

    return this.toDomain(updated);
  }
}
