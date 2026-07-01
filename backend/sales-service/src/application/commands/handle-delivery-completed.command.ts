// =============================================================================
// HANDLE DELIVERY COMPLETED COMMAND — When a DO is delivered, update SO status
// =============================================================================
// This was refactored from the original FulfilSalesOrderCommand.
// Now works with partial delivery: checks if all SO lines are fully delivered.

import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EVENT, type SalesOrderFulfilledPayload } from '@erp/shared';

import {
  InvalidStatusTransitionError,
  type SalesOrder,
  type DeliveryOrder,
} from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
  DELIVERY_ORDER_REPOSITORY,
  type IDeliveryOrderRepository,
  type OutboxEventInput,
} from '../../domain/repositories/index.js';

@Injectable()
export class HandleDeliveryCompletedCommand {
  private readonly logger = new Logger(HandleDeliveryCompletedCommand.name);

  constructor(
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly soRepo: ISalesOrderRepository,
    @Inject(DELIVERY_ORDER_REPOSITORY)
    private readonly deliveryRepo: IDeliveryOrderRepository,
  ) {}

  /**
   * Called when a DeliveryOrder transitions to "delivered".
   * Checks all deliveries for the SO to determine if all lines are fully delivered,
   * and issues the just-delivered quantities out of reserved inventory.
   *
   * @param salesOrderId       the SO whose delivery just completed
   * @param deliveredDeliveryId the DeliveryOrder that just reached "delivered"
   *   — its lines are the DELTA to issue this time (partial deliveries each
   *   issue only their own quantity, never the cumulative total).
   */
  async execute(salesOrderId: string, deliveredDeliveryId?: string) {
    const order = await this.soRepo.findByIdWithLines(salesOrderId);
    if (!order) {
      throw new NotFoundException(`Sales order "${salesOrderId}" not found`);
    }

    // Get all deliveries for this SO
    const deliveries = await this.deliveryRepo.findBySalesOrderId(salesOrderId);
    const deliveredDOs = deliveries.filter((d) => d.status === 'delivered');

    // Calculate total delivered qty per SO line
    const deliveredByLine = new Map<string, number>();
    for (const delivery of deliveredDOs) {
      for (const line of delivery.lines) {
        const current = deliveredByLine.get(line.salesOrderLineId) ?? 0;
        deliveredByLine.set(line.salesOrderLineId, current + line.quantity);
      }
    }

    // Check if all SO lines are fully delivered
    const allLinesDelivered = order.lines.every((soLine) => {
      const delivered = deliveredByLine.get(soLine.id) ?? 0;
      return delivered >= soLine.quantity;
    });

    const previousStatus = order.status;
    try {
      order.recordDelivery(allLinesDelivered);
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Emit sales-order.fulfilled for the JUST-delivered DO so inventory issues
    // the reserved stock out (issueReserved). Carrying only this delivery's
    // lines means partial deliveries each issue their own delta exactly once
    // (inventory's subscriber is idempotent per message). Without this the
    // reserved quantity would stay locked forever after goods physically ship.
    const events = this.buildFulfilledEvents(
      order,
      deliveries,
      deliveredDeliveryId,
    );

    await this.soRepo.update(
      order,
      events,
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

    this.logger.log(
      `SO "${salesOrderId}" → ${order.status} (${allLinesDelivered ? 'all lines delivered' : 'partial delivery'})`,
    );

    return {
      id: order.id,
      status: order.status,
      allLinesDelivered,
    };
  }

  /**
   * Build the sales-order.fulfilled outbox event for the delivery that just
   * completed. Only that DO's lines are emitted (the delta), so inventory
   * issues exactly the shipped quantity out of reserved stock.
   */
  private buildFulfilledEvents(
    order: SalesOrder,
    deliveries: DeliveryOrder[],
    deliveredDeliveryId?: string,
  ): OutboxEventInput[] {
    if (!deliveredDeliveryId) {
      return [];
    }

    const deliveredDO = deliveries.find(
      (d) => d.id === deliveredDeliveryId && d.status === 'delivered',
    );
    if (!deliveredDO || deliveredDO.lines.length === 0) {
      this.logger.warn(
        `Delivered DO "${deliveredDeliveryId}" not found for SO "${order.id}" ` +
          `— no inventory issue emitted (reserved stock may stay locked)`,
      );
      return [];
    }

    const payload: SalesOrderFulfilledPayload = {
      orderId: order.id,
      customerId: order.customerId,
      lines: deliveredDO.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
      })),
    };

    return [
      {
        eventType: EVENT.SALES_ORDER_FULFILLED,
        payload: payload as unknown as Record<string, unknown>,
      },
    ];
  }
}
