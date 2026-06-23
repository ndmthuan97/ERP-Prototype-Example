import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EVENT, type SalesOrderCancelledPayload } from '@erp/shared';

import { InvalidStatusTransitionError } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { validateCancelOrder } from '../dtos/index.js';

@Injectable()
export class CancelSalesOrderCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Hủy đơn hàng (draft hoặc confirmed) với lý do.
   * Nếu confirmed → phát order.cancelled để inventory release stock (compensation).
   */
  async execute(orderId: string, dto: unknown) {
    const { reason } = validateCancelOrder(dto);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const previousStatus = order.status;
    const wasConfirmed = order.status === 'confirmed';

    try {
      order.cancel(reason);
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Nếu đơn đã confirmed → cần compensation: release inventory
    const events = wasConfirmed
      ? [{
          eventType: EVENT.SALES_ORDER_CANCELLED,
          payload: {
            orderId: order.id,
            reason,
            lines: order.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
          } as unknown as Record<string, unknown>,
        }]
      : [];

    await this.repo.update(
      order,
      events,
      {
        fromStatus: previousStatus,
        toStatus: 'cancelled',
        changedBy: 'system',
        reason,
      },
      {
        customerName: '',
        status: 'cancelled',
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt,
        lastStatusChange: new Date(),
      },
    );

    return {
      id: order.id,
      status: order.status,
      cancelReason: order.cancelReason,
      cancelledAt: order.updatedAt.toISOString(),
    };
  }
}
