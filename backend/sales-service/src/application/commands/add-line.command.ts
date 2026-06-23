import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { SalesOrderLine } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { validateAddLine } from '../dtos/index.js';

@Injectable()
export class AddLineCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Thêm dòng hàng vào đơn (chỉ khi draft).
   * Snapshot pattern: itemName copy tại thời điểm tạo.
   * Auto recalculate totalAmount qua SalesOrder.addLine().
   */
  async execute(orderId: string, dto: unknown) {
    const { itemId, itemName, quantity, unitPrice } = validateAddLine(dto);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const line = SalesOrderLine.create(uuidv4(), itemId, itemName, quantity, unitPrice);
    order.addLine(line); // validate draft + recalculate

    const updated = await this.repo.addLine(order, {
      customerName: '',
      status: order.status,
      totalAmount: Number(order.totalAmount),
      lineCount: order.lines.length,
      createdAt: order.createdAt,
      lastStatusChange: new Date(),
    });

    // Trả line vừa thêm
    return updated.lines[updated.lines.length - 1];
  }
}
