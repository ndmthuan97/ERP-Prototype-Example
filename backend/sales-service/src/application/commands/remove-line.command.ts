import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import {
  InvalidStatusTransitionError,
  LineNotFoundError,
} from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class RemoveLineCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Xóa dòng hàng khỏi đơn (chỉ khi draft).
   * Auto recalculate totalAmount qua SalesOrder.removeLine().
   */
  async execute(orderId: string, lineId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    try {
      order.removeLine(lineId); // validate draft + line tồn tại + recalculate
    } catch (error) {
      if (error instanceof LineNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const updated = await this.repo.removeLine(order, lineId, {
      customerName: '',
      status: order.status,
      totalAmount: Number(order.totalAmount),
      lineCount: order.lines.length,
      createdAt: order.createdAt,
      lastStatusChange: new Date(),
    });

    // Trả đơn hàng sau khi cập nhật (header + lines)
    return {
      id: updated.id,
      customerId: updated.customerId,
      status: updated.status,
      totalAmount: Number(updated.totalAmount),
      cancelReason: updated.cancelReason,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      lines: updated.lines.map((l) => ({
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
