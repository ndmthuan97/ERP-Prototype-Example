import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EVENT, type OrderSubmittedPayload } from '@erp/shared';

import {
  EmptyOrderError,
  InvalidStatusTransitionError,
} from '../../domain/entities/index.js';
import {
  ORDER_REPOSITORY,
  type IOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class SubmitOrderCommand {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repo: IOrderRepository,
  ) {}

  /**
   * Submit đơn hàng: draft → submitted.
   * Ghi outbox event `order.submitted` → outbox worker publish lên Pub/Sub
   * → inventory-service lắng nghe → reserve stock (saga bắt đầu).
   */
  async execute(orderId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const previousStatus = order.status;
    try {
      order.submit(); // validate draft + có lines
    } catch (error) {
      if (error instanceof EmptyOrderError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Payload cho outbox event — inventory-service sẽ đọc lines để reserve
    const payload: OrderSubmittedPayload = {
      orderId: order.id,
      customerId: order.customerId,
      totalAmount: Number(order.totalAmount),
      lines: order.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
      })),
    };

    await this.repo.update(
      order,
      [{ eventType: EVENT.ORDER_SUBMITTED, payload: payload as unknown as Record<string, unknown> }],
      {
        fromStatus: previousStatus,
        toStatus: 'submitted',
        changedBy: 'system',
      },
      {
        customerName: '',
        status: 'submitted',
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt,
        lastStatusChange: new Date(),
      },
    );

    return {
      id: order.id,
      status: order.status,
      message: 'Order submitted. Saga processing...',
    };
  }
}
