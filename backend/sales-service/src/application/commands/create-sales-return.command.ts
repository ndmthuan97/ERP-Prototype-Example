// =============================================================================
// CREATE SALES RETURN COMMAND — Create a return for a fulfilled order
// =============================================================================
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { SalesReturn, SalesReturnLine } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
  SALES_RETURN_REPOSITORY,
  type ISalesReturnRepository,
} from '../../domain/repositories/index.js';

const createReturnSchema = z.object({
  reason: z.string().min(1, 'Return reason is required'),
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().min(1),
        quantity: z.number().positive(),
        reason: z.string().optional(),
      }),
    )
    .min(1, 'At least one return line is required'),
});

@Injectable()
export class CreateSalesReturnCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly soRepo: ISalesOrderRepository,
    @Inject(SALES_RETURN_REPOSITORY) private readonly returnRepo: ISalesReturnRepository,
  ) {}

  async execute(salesOrderId: string, dto: unknown) {
    const validated = createReturnSchema.parse(dto);

    const order = await this.soRepo.findByIdWithLines(salesOrderId);
    if (!order) {
      throw new NotFoundException(`Sales order "${salesOrderId}" not found`);
    }
    if (order.status !== 'fully_delivered') {
      throw new BadRequestException(
        `Cannot create return for order in status "${order.status}"`,
      );
    }

    const salesReturn = SalesReturn.createDraft(
      uuidv4(),
      salesOrderId,
      order.customerId,
      validated.reason,
    );

    for (const lineInput of validated.lines) {
      const soLine = order.lines.find((l) => l.id === lineInput.salesOrderLineId);
      if (!soLine) {
        throw new NotFoundException(
          `Sales order line "${lineInput.salesOrderLineId}" not found`,
        );
      }
      const returnLine = SalesReturnLine.create(
        uuidv4(),
        lineInput.salesOrderLineId,
        soLine.itemId,
        soLine.itemName,
        lineInput.quantity,
        soLine.unitPrice,
        lineInput.reason,
      );
      salesReturn.addLine(returnLine);
    }

    return this.returnRepo.create(salesReturn);
  }
}
