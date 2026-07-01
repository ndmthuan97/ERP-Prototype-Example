// =============================================================================
// FULFIL SALES ORDER COMMAND — Legacy fulfil (delegates to delivery flow)
// =============================================================================
// This command is retained for backward compatibility.
// For new code, use CreateDeliveryOrderCommand + UpdateDeliveryStatusCommand.

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
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Quick-fulfil: marks SO as fully_delivered in a single step.
   * Publishes sales-order.fulfilled event for inventory-service.
   */
  async execute(orderId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const previousStatus = order.status;
    try {
      order.recordDelivery(true);
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

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
      [
        {
          eventType: EVENT.SALES_ORDER_FULFILLED,
          payload: payload as unknown as Record<string, unknown>,
        },
      ],
      {
        fromStatus: previousStatus,
        toStatus: order.status,
        changedBy: 'system',
      },
      {
        customerName: '',
        status: order.status,
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
