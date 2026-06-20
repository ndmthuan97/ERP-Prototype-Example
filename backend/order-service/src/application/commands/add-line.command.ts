import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { OrderLine } from '../../domain/entities/index.js';
import {
  ORDER_REPOSITORY,
  type IOrderRepository,
} from '../../domain/repositories/index.js';
import { validateAddLine } from '../dtos/index.js';

@Injectable()
export class AddLineCommand {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repo: IOrderRepository,
  ) {}

  /**
   * Thêm dòng hàng vào đơn (chỉ khi draft).
   * Snapshot pattern: itemName copy tại thời điểm tạo.
   * Auto recalculate totalAmount qua OrderHeader.addLine().
   */
  async execute(orderId: string, dto: unknown) {
    const { itemId, itemName, quantity, unitPrice } = validateAddLine(dto);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const line = OrderLine.create(uuidv4(), itemId, itemName, quantity, unitPrice);
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
