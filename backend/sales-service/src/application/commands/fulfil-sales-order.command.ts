import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EVENT, type SalesOrderFulfilledPayload } from '@erp/shared';

import { InvalidStatusTransitionError } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class FulfilSalesOrderCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Fulfil order: confirmed → fulfilled.
   * Publishes sales-order.fulfilled event with line details
   * so inventory-service can issue stock.
   */
  async execute(orderId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const previousStatus = order.status;
    try {
      order.fulfil();
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Payload for outbox event — inventory-service reads lines to issue stock
    const payload: SalesOrderFulfilledPayload = {
      orderId: order.id,
      customerId: order.customerId,
      lines: order.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
      })),
    };

    await this.repo.update(
      order,
      [{ eventType: EVENT.SALES_ORDER_FULFILLED, payload: payload as unknown as Record<string, unknown> }],
      {
        fromStatus: previousStatus,
        toStatus: 'fulfilled',
        changedBy: 'system',
      },
      {
        customerName: '',
        status: 'fulfilled',
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt,
        lastStatusChange: new Date(),
      },
    );

    return {
      id: order.id,
      status: order.status,
      message: 'Order fulfilled successfully.',
    };
  }
}
