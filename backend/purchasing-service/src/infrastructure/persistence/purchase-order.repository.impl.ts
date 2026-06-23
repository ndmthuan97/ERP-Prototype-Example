// =============================================================================
// PRISMA PURCHASE ORDER REPOSITORY — Implementation of IPurchaseOrderRepository
// =============================================================================
// Adapter in Hexagonal architecture:
//   Port (interface):    IPurchaseOrderRepository in domain layer
//   Adapter (implement): PrismaPurchaseOrderRepository in infrastructure layer
//
// Responsibilities:
//   1. Map between Prisma model (DB) ↔ Domain entity
//   2. CRUD operations via PrismaService
//   3. Write outbox events in the same transaction (Outbox Pattern)
//   4. Optimistic locking via version field

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import {
  PurchaseOrder,
  PurchaseOrderLine,
  type PurchaseOrderStatus,
} from '../../domain/entities/index.js';
import type {
  IPurchaseOrderRepository,
  PaginatedResult,
  SearchPurchaseOrdersParams,
  OutboxEventInput,
} from '../../domain/repositories/index.js';
import { PrismaService } from './prisma.service.js';

// Type alias for Prisma record with lines included
type PORecord = {
  id: string;
  supplierId: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lines: POLineRecord[];
};

type POLineRecord = {
  id: string;
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: Prisma.Decimal;
};

@Injectable()
export class PrismaPurchaseOrderRepository
  implements IPurchaseOrderRepository
{
  private readonly logger = new Logger(PrismaPurchaseOrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // MAPPING
  // ==========================================================================

  private toDomain(record: PORecord): PurchaseOrder {
    const lines = record.lines.map(
      (l) =>
        new PurchaseOrderLine({
          id: l.id,
          productId: l.productId,
          productName: l.productName,
          orderedQty: l.orderedQty,
          receivedQty: l.receivedQty,
          unitCost: l.unitCost.toNumber(),
        }),
    );

    return new PurchaseOrder({
      id: record.id,
      supplierId: record.supplierId,
      status: record.status as PurchaseOrderStatus,
      version: record.version,
      lines,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  async findById(id: string): Promise<PurchaseOrder | null> {
    const record = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async search(
    params: SearchPurchaseOrdersParams,
  ): Promise<PaginatedResult<PurchaseOrder>> {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(params.status && { status: params.status }),
    };

    const skip = (params.page - 1) * params.limit;

    const [total, records] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
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

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  async create(order: PurchaseOrder): Promise<PurchaseOrder> {
    const record = await this.prisma.purchaseOrder.create({
      data: {
        id: order.id,
        supplierId: order.supplierId,
        status: order.status,
        version: order.version,
      },
      include: { lines: true },
    });

    this.logger.log(`PurchaseOrder created: id=${record.id}`);
    return this.toDomain(record);
  }

  async save(
    order: PurchaseOrder,
    events?: OutboxEventInput[],
  ): Promise<PurchaseOrder> {
    const expectedVersion = order.version - 1;

    const record = await this.prisma.$transaction(async (tx) => {
      // Optimistic locking: update only if version matches
      const updated = await tx.purchaseOrder.updateMany({
        where: { id: order.id, version: expectedVersion },
        data: {
          status: order.status,
          version: order.version,
          updatedAt: order.updatedAt,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          `Purchase order "${order.id}" was modified by another request (optimistic lock)`,
        );
      }

      // Update all lines (receivedQty may have changed)
      for (const line of order.lines) {
        await tx.purchaseOrderLine.updateMany({
          where: { id: line.id, headerId: order.id },
          data: {
            receivedQty: line.receivedQty,
          },
        });
      }

      // Write outbox events in the same transaction
      if (events && events.length > 0) {
        await tx.outbox.createMany({
          data: events.map((e) => ({
            id: uuidv4(),
            aggregateType: 'PurchaseOrder',
            aggregateId: order.id,
            eventType: e.eventType,
            payload: e.payload,
          })),
        });
      }

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
    });

    this.logger.log(
      `PurchaseOrder saved: id=${record.id}, status=${record.status}, version=${record.version}`,
    );
    return this.toDomain(record);
  }

  async addLine(order: PurchaseOrder): Promise<PurchaseOrder> {
    // The last line in the array is the newly added one
    const newLine = order.lines[order.lines.length - 1];

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderLine.create({
        data: {
          id: newLine.id,
          headerId: order.id,
          productId: newLine.productId,
          productName: newLine.productName,
          orderedQty: newLine.orderedQty,
          receivedQty: newLine.receivedQty,
          unitCost: newLine.unitCost,
        },
      });

      // Bump version + updatedAt
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { lines: true },
      });
    });

    this.logger.log(
      `PurchaseOrderLine added: lineId=${newLine.id}, headerId=${order.id}`,
    );
    return this.toDomain(record);
  }

  async removeLine(orderId: string, lineId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderLine.delete({
        where: { id: lineId },
      });

      await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `PurchaseOrderLine removed: lineId=${lineId}, headerId=${orderId}`,
    );
  }
}
