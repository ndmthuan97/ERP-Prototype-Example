// =============================================================================
// PRISMA DELIVERY ORDER REPOSITORY — Implementation (Infrastructure Layer)
// =============================================================================

import { Injectable, Logger } from '@nestjs/common';
import type {
  DeliveryOrder as PrismaDeliveryOrder,
  DeliveryLine as PrismaDeliveryLine,
} from '@prisma/client';

import { DeliveryOrder } from '../../domain/entities/delivery-order.entity.js';
import { DeliveryLine } from '../../domain/entities/delivery-line.entity.js';
import type { IDeliveryOrderRepository } from '../../domain/repositories/delivery-order.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaDeliveryOrderRepository implements IDeliveryOrderRepository {
  private readonly logger = new Logger(PrismaDeliveryOrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDomain(
    record: PrismaDeliveryOrder & { lines?: PrismaDeliveryLine[] },
  ): DeliveryOrder {
    const lines = (record.lines ?? []).map(
      (l) =>
        new DeliveryLine({
          id: l.id,
          salesOrderLineId: l.salesOrderLineId,
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: Number(l.quantity),
        }),
    );

    return new DeliveryOrder({
      id: record.id,
      salesOrderId: record.salesOrderId,
      status: record.status as DeliveryOrder['status'],
      failReason: record.failReason,
      version: record.version,
      lines,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findById(id: string): Promise<DeliveryOrder | null> {
    const record = await this.prisma.deliveryOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findBySalesOrderId(salesOrderId: string): Promise<DeliveryOrder[]> {
    const records = await this.prisma.deliveryOrder.findMany({
      where: { salesOrderId },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(delivery: DeliveryOrder): Promise<DeliveryOrder> {
    const record = await this.prisma.deliveryOrder.create({
      data: {
        id: delivery.id,
        salesOrderId: delivery.salesOrderId,
        status: delivery.status,
        failReason: delivery.failReason,
        version: 0,
        lines: {
          create: delivery.lines.map((line) => ({
            id: line.id,
            salesOrderLineId: line.salesOrderLineId,
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: true },
    });

    this.logger.log(
      `Delivery order created: id="${record.id}", SO="${record.salesOrderId}"`,
    );
    return this.toDomain(record);
  }

  async update(delivery: DeliveryOrder): Promise<DeliveryOrder> {
    const record = await this.prisma.deliveryOrder.update({
      where: { id: delivery.id },
      data: {
        status: delivery.status,
        failReason: delivery.failReason,
        version: { increment: 1 },
        updatedAt: delivery.updatedAt,
      },
      include: { lines: true },
    });
    return this.toDomain(record);
  }
}
