// =============================================================================
// CREATE DELIVERY ORDER COMMAND — Create a new delivery for a confirmed SO
// =============================================================================
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { DeliveryOrder, DeliveryLine } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
  DELIVERY_ORDER_REPOSITORY,
  type IDeliveryOrderRepository,
} from '../../domain/repositories/index.js';

const createDeliverySchema = z.object({
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().min(1),
        quantity: z.number().positive(),
      }),
    )
    .min(1, 'At least one delivery line is required'),
});

@Injectable()
export class CreateDeliveryOrderCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly soRepo: ISalesOrderRepository,
    @Inject(DELIVERY_ORDER_REPOSITORY) private readonly deliveryRepo: IDeliveryOrderRepository,
  ) {}

  async execute(salesOrderId: string, dto: unknown) {
    const validated = createDeliverySchema.parse(dto);

    const order = await this.soRepo.findByIdWithLines(salesOrderId);
    if (!order) {
      throw new NotFoundException(`Sales order "${salesOrderId}" not found`);
    }
    const allowedStatuses = ['confirmed', 'partially_delivered'];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot create delivery for order in status "${order.status}"`,
      );
    }

    const delivery = DeliveryOrder.createFromOrder(uuidv4(), salesOrderId);

    for (const lineInput of validated.lines) {
      const soLine = order.lines.find((l) => l.id === lineInput.salesOrderLineId);
      if (!soLine) {
        throw new NotFoundException(
          `Sales order line "${lineInput.salesOrderLineId}" not found`,
        );
      }
      const deliveryLine = DeliveryLine.create(
        uuidv4(),
        lineInput.salesOrderLineId,
        soLine.itemId,
        soLine.itemName,
        lineInput.quantity,
      );
      delivery.addLine(deliveryLine);
    }

    return this.deliveryRepo.create(delivery);
  }
}
