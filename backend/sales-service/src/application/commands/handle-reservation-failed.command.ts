// =============================================================================
// HANDLE RESERVATION FAILED — Saga step 3b
// =============================================================================
// Nhận event inventory.reservation-failed → cancel order (không cần compensation
// vì stock chưa được reserve).

import { Injectable, Inject, Logger } from '@nestjs/common';
import { type EventEnvelope, type InventoryReservationFailedPayload } from '@erp/shared';

import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class HandleReservationFailedCommand {
  private readonly logger = new Logger(HandleReservationFailedCommand.name);

  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as InventoryReservationFailedPayload;
    const { orderId, reason } = payload;

    this.logger.log(`Saga step 3b: reservation failed for order "${orderId}"`);

    const order = await this.repo.findByIdWithLines(orderId);
    if (!order || order.status !== 'submitted') {
      this.logger.warn(
        `Order "${orderId}" is not in submitted status — skip`,
      );
      return;
    }

    const previousStatus = order.status;
    order.markFailedNoStock();

    await this.repo.update(
      order,
      [], // Không cần phát event compensation — stock chưa reserve
      {
        fromStatus: previousStatus,
        toStatus: 'cancelled',
        changedBy: 'system',
        reason: reason ?? 'Inventory reservation failed',
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

    this.logger.log(`Order "${orderId}" cancelled — insufficient stock`);
  }
}
