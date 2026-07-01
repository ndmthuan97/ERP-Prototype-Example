// =============================================================================
// HANDLE SALES RETURN RECEIVED — Cross-context stock inbound (returns)
// =============================================================================
// Receives sales-return.goods-received event → increase available stock for
// each returned line (customer returned goods that physically came back).
// Uses optimistic retry per line to handle concurrent updates.

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  type EventEnvelope,
  type SalesReturnGoodsReceivedPayload,
} from '@erp/shared';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class HandleSalesReturnReceivedCommand {
  private readonly logger = new Logger(HandleSalesReturnReceivedCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as SalesReturnGoodsReceivedPayload;
    const { returnId, orderId, lines } = payload;

    this.logger.log(
      `Restocking returned goods for return "${returnId}" (order "${orderId}") — ${lines.length} line(s)`,
    );

    for (const line of lines) {
      await withOptimisticRetry(async () => {
        const item = await this.repo.findById(line.itemId);
        if (!item) {
          this.logger.warn(
            `StockItem "${line.itemId}" not found — skipping return restock`,
          );
          return;
        }

        item.receive(line.quantity);

        await this.repo.saveWithMovement(item, {
          itemId: item.id,
          type: 'IN',
          quantity: line.quantity,
          reason: 'sales_return',
          reference: returnId,
        });
      });
    }

    this.logger.log(`✅ Returned goods restocked for return "${returnId}"`);
  }
}
