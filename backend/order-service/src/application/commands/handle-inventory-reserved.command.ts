// =============================================================================
// HANDLE INVENTORY RESERVED — Saga step 3a
// =============================================================================
// Nhận event inventory.reserved → credit check HTTP → confirm hoặc cancel.
// Thứ tự reserve trước, credit-check sau là CHỦ Ý: buộc phải compensation
// (release stock) khi credit fail → đúng mục tiêu học Saga compensation.

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  EVENT,
  type EventEnvelope,
  type InventoryReservedPayload,
  type OrderConfirmedPayload,
  type OrderCancelledPayload,
} from '@erp/shared';

import {
  ORDER_REPOSITORY,
  type IOrderRepository,
} from '../../domain/repositories/index.js';
import { CustomerClient } from '../../infrastructure/http/customer-client.js';

@Injectable()
export class HandleInventoryReservedCommand {
  private readonly logger = new Logger(HandleInventoryReservedCommand.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repo: IOrderRepository,
    private readonly customerClient: CustomerClient,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as InventoryReservedPayload;
    const { orderId } = payload;

    this.logger.log(`Saga step 3a: inventory reserved cho order "${orderId}"`);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order || order.status !== 'submitted') {
      this.logger.warn(
        `Order "${orderId}" không ở trạng thái submitted — skip`,
      );
      return;
    }

    // Credit check HTTP đồng bộ → customer-service
    try {
      const credit = await this.customerClient.checkCredit(
        order.customerId,
        Number(order.totalAmount),
      );

      if (credit.sufficient) {
        // Credit OK → confirm
        const previousStatus = order.status;
        order.confirm();

        const confirmPayload: OrderConfirmedPayload = {
          orderId: order.id,
        };
        await this.repo.update(
          order,
          [{ eventType: EVENT.ORDER_CONFIRMED, payload: confirmPayload as unknown as Record<string, unknown> }],
          { fromStatus: previousStatus, toStatus: 'confirmed', changedBy: 'system' },
          {
            customerName: '',
            status: 'confirmed',
            totalAmount: Number(order.totalAmount),
            lineCount: order.lines.length,
            createdAt: order.createdAt,
            lastStatusChange: new Date(),
          },
        );
        this.logger.log(`✅ Order "${orderId}" confirmed — saga hoàn tất`);
      } else {
        // Credit không đủ → cancel + compensation (release stock)
        const reason = `Credit không đủ: cần ${Number(order.totalAmount)}, khả dụng ${credit.available}`;
        const previousStatus = order.status;
        order.markFailedCredit(reason);

        const cancelPayload: OrderCancelledPayload = {
          orderId: order.id,
          reason,
        };
        await this.repo.update(
          order,
          [{ eventType: EVENT.ORDER_CANCELLED, payload: cancelPayload as unknown as Record<string, unknown> }],
          { fromStatus: previousStatus, toStatus: 'cancelled', changedBy: 'system', reason },
          {
            customerName: '',
            status: 'cancelled',
            totalAmount: Number(order.totalAmount),
            lineCount: order.lines.length,
            createdAt: order.createdAt,
            lastStatusChange: new Date(),
          },
        );
        this.logger.log(`❌ Order "${orderId}" cancelled — credit không đủ`);
      }
    } catch (error) {
      // Credit check lỗi kỹ thuật → cancel (safe default)
      const reason = `Credit check lỗi: ${error instanceof Error ? error.message : String(error)}`;
      const previousStatus = order.status;
      order.markFailedCredit(reason);

      const cancelPayload: OrderCancelledPayload = {
        orderId: order.id,
        reason,
      };
      await this.repo.update(
        order,
        [{ eventType: EVENT.ORDER_CANCELLED, payload: cancelPayload as unknown as Record<string, unknown> }],
        { fromStatus: previousStatus, toStatus: 'cancelled', changedBy: 'system', reason },
        {
          customerName: '',
          status: 'cancelled',
          totalAmount: Number(order.totalAmount),
          lineCount: order.lines.length,
          createdAt: order.createdAt,
          lastStatusChange: new Date(),
        },
      );
      this.logger.error(`❌ Order "${orderId}" cancelled — credit check lỗi`, reason);
    }
  }
}
