// =============================================================================
// HANDLE GOODS RECEIVED — Cross-context stock inbound
// =============================================================================
// Receives goods.received event → increase available stock for each receipt line.
// Uses optimistic retry per receipt to handle concurrent updates.

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  type EventEnvelope,
  type GoodsReceivedPayload,
} from '@erp/shared';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class HandleGoodsReceivedCommand {
  private readonly logger = new Logger(HandleGoodsReceivedCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as GoodsReceivedPayload;
    const { orderId, receipts } = payload;

    this.logger.log(
      `Receiving stock for PO "${orderId}" — ${receipts.length} receipt(s)`,
    );

    for (const receipt of receipts) {
      await withOptimisticRetry(async () => {
        const item = await this.repo.findBySku(receipt.sku);
        if (!item) {
          this.logger.warn(
            `StockItem for SKU "${receipt.sku}" not found — skipping receipt`,
          );
          return;
        }

        item.receive(receipt.quantity);

        await this.repo.saveWithMovement(item, {
          itemId: item.id,
          type: 'IN',
          quantity: receipt.quantity,
          reason: 'purchase_receive',
          reference: orderId,
        });
      });
    }

    this.logger.log(`✅ Goods received for PO "${orderId}"`);
  }
}
