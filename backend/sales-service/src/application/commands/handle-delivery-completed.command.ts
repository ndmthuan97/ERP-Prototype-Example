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

import { InvalidStatusTransitionError } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
  DELIVERY_ORDER_REPOSITORY,
  type IDeliveryOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class HandleDeliveryCompletedCommand {
  private readonly logger = new Logger(HandleDeliveryCompletedCommand.name);

  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly soRepo: ISalesOrderRepository,
    @Inject(DELIVERY_ORDER_REPOSITORY) private readonly deliveryRepo: IDeliveryOrderRepository,
  ) {}

  /**
   * Called when a DeliveryOrder transitions to "delivered".
   * Checks all deliveries for the SO to determine if all lines are fully delivered.
   */
  async execute(salesOrderId: string) {
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

    await this.soRepo.update(
      order,
      undefined,
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
}
