// =============================================================================
// PRISMA SALES RETURN REPOSITORY — Implementation (Infrastructure Layer)
// =============================================================================

import { Injectable, Logger } from '@nestjs/common';
import type {
  SalesReturn as PrismaSalesReturn,
  SalesReturnLine as PrismaSalesReturnLine,
} from '@prisma/client';

import { SalesReturn } from '../../domain/entities/sales-return.entity.js';
import { SalesReturnLine } from '../../domain/entities/sales-return-line.entity.js';
import type { ISalesReturnRepository } from '../../domain/repositories/sales-return.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaSalesReturnRepository implements ISalesReturnRepository {
  private readonly logger = new Logger(PrismaSalesReturnRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDomain(
    record: PrismaSalesReturn & { lines?: PrismaSalesReturnLine[] },
  ): SalesReturn {
    const lines = (record.lines ?? []).map(
      (l) =>
        new SalesReturnLine({
          id: l.id,
          salesOrderLineId: l.salesOrderLineId,
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          reason: l.reason,
        }),
    );

    return new SalesReturn({
      id: record.id,
      salesOrderId: record.salesOrderId,
      customerId: record.customerId,
      status: record.status as SalesReturn['status'],
      reason: record.reason,
      totalRefundAmount: Number(record.totalRefundAmount),
      lines,
      approvedAt: record.approvedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findById(id: string): Promise<SalesReturn | null> {
    const record = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: { lines: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findBySalesOrderId(salesOrderId: string): Promise<SalesReturn[]> {
    const records = await this.prisma.salesReturn.findMany({
      where: { salesOrderId },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(salesReturn: SalesReturn): Promise<SalesReturn> {
    const record = await this.prisma.salesReturn.create({
      data: {
        id: salesReturn.id,
        salesOrderId: salesReturn.salesOrderId,
        customerId: salesReturn.customerId,
        status: salesReturn.status,
        reason: salesReturn.reason,
        totalRefundAmount: salesReturn.totalRefundAmount,
        approvedAt: salesReturn.approvedAt,
        completedAt: salesReturn.completedAt,
        lines: {
          create: salesReturn.lines.map((line) => ({
            id: line.id,
            salesOrderLineId: line.salesOrderLineId,
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            reason: line.reason,
          })),
        },
      },
      include: { lines: true },
    });

    this.logger.log(
      `Sales return created: id="${record.id}", SO="${record.salesOrderId}"`,
    );
    return this.toDomain(record);
  }

  async update(salesReturn: SalesReturn): Promise<SalesReturn> {
    const record = await this.prisma.salesReturn.update({
      where: { id: salesReturn.id },
      data: {
        status: salesReturn.status,
        totalRefundAmount: salesReturn.totalRefundAmount,
        approvedAt: salesReturn.approvedAt,
        completedAt: salesReturn.completedAt,
        updatedAt: salesReturn.updatedAt,
      },
      include: { lines: true },
    });
    return this.toDomain(record);
  }
}
