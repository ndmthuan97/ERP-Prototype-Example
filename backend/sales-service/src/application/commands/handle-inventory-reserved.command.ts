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
  type SalesOrderConfirmedPayload,
  type SalesOrderCancelledPayload,
} from '@erp/shared';

import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { CustomerClient } from '../../infrastructure/http/customer-client.js';

@Injectable()
export class HandleInventoryReservedCommand {
  private readonly logger = new Logger(HandleInventoryReservedCommand.name);

  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
    private readonly customerClient: CustomerClient,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as InventoryReservedPayload;
    const { orderId } = payload;

    this.logger.log(`Saga step 3a: inventory reserved for order "${orderId}"`);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order || order.status !== 'submitted') {
      this.logger.warn(
        `Order "${orderId}" is not in submitted status — skip`,
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

        const confirmPayload: SalesOrderConfirmedPayload = {
          orderId: order.id,
        };
        await this.repo.update(
          order,
          [{ eventType: EVENT.SALES_ORDER_CONFIRMED, payload: confirmPayload as unknown as Record<string, unknown> }],
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
        this.logger.log(`Order "${orderId}" confirmed — saga completed`);
      } else {
        // Credit insufficient → cancel + compensation (release stock)
        const reason = `Insufficient credit: required ${Number(order.totalAmount)}, available ${credit.available}`;
        const previousStatus = order.status;
        order.markFailedCredit(reason);

        const cancelPayload: SalesOrderCancelledPayload = {
          orderId: order.id,
          reason,
          lines: order.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        };
        await this.repo.update(
          order,
          [{ eventType: EVENT.SALES_ORDER_CANCELLED, payload: cancelPayload as unknown as Record<string, unknown> }],
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
        this.logger.log(`Order "${orderId}" cancelled — insufficient credit`);
      }
    } catch (error) {
      // Credit check technical error → cancel (safe default)
      const reason = `Credit check error: ${error instanceof Error ? error.message : String(error)}`;
      const previousStatus = order.status;
      order.markFailedCredit(reason);

      const cancelPayload: SalesOrderCancelledPayload = {
        orderId: order.id,
        reason,
        lines: order.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      };
      await this.repo.update(
        order,
        [{ eventType: EVENT.SALES_ORDER_CANCELLED, payload: cancelPayload as unknown as Record<string, unknown> }],
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
      this.logger.error(`Order "${orderId}" cancelled — credit check error`, reason);
    }
  }
}
