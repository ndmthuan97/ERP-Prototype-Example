import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetSalesOrderQuery {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly repo: ISalesOrderRepository,
  ) {}

  /** Lấy chi tiết đơn hàng (header + lines) */
  async execute(orderId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }
    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      cancelReason: order.cancelReason,
      version: order.version,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemName: l.itemName,
        quantity: l.quantity,
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    };
  }
}
