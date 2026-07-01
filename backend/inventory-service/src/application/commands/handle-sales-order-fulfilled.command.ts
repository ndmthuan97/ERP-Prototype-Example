// =============================================================================
// HANDLE SALES ORDER FULFILLED — Cross-context stock outbound
// =============================================================================
// Receives sales-order.fulfilled event → issue (decrease) stock for each line item.
// Uses optimistic retry per line to handle concurrent updates.

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  type EventEnvelope,
  type SalesOrderFulfilledPayload,
  type SalesOrderLineRef,
} from '@erp/shared';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class HandleSalesOrderFulfilledCommand {
  private readonly logger = new Logger(HandleSalesOrderFulfilledCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as SalesOrderFulfilledPayload;
    const { orderId, lines } = payload as {
      orderId: string;
      lines: SalesOrderLineRef[];
    };

    this.logger.log(
      `Issuing stock for fulfilled order "${orderId}" — ${lines.length} line(s)`,
    );

    for (const line of lines) {
      await withOptimisticRetry(async () => {
        const item = await this.repo.findById(line.itemId);
        if (!item) {
          this.logger.warn(
            `StockItem "${line.itemId}" not found — skipping issue`,
          );
          return;
        }

        // Ship reserved stock: draw down `reserved` only (the quantity already
        // left `available` when the order was submitted/reserved). Using
        // issue() here would double-count against `available`.
        item.issueReserved(line.quantity, orderId);

        await this.repo.saveWithMovement(item, {
          itemId: item.id,
          type: 'OUT',
          quantity: line.quantity,
          reason: 'sales_issue',
          reference: orderId,
        });
      });
    }

    this.logger.log(`✅ Stock issued for fulfilled order "${orderId}"`);
  }
}
