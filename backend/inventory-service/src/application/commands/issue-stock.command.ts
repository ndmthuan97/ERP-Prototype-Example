import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EVENT } from '@erp/shared';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateIssueStock } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class IssueStockCommand {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Issue stock by SKU (reduce quantityAvailable). Optimistic lock + retry.
   * Records a StockMovement OUT and publishes `inventory.issued` outbox event.
   *
   * @throws NotFoundException if SKU does not exist
   * @throws InsufficientStockError if not enough available stock
   */
  async execute(sku: string, dto: unknown): Promise<StockItem> {
    const { quantity, reference, reason } = validateIssueStock(dto);

    return withOptimisticRetry(async () => {
      const item = await this.repo.findBySku(sku);
      if (!item) {
        throw new NotFoundException(`Stock item not found for SKU "${sku}"`);
      }

      item.issue(quantity, reference);

      return this.repo.saveWithMovement(
        item,
        {
          itemId: item.id,
          type: 'OUT',
          quantity,
          reason,
          reference,
        },
        {
          eventType: EVENT.INVENTORY_ISSUED,
          payload: { sku, quantity, reason, reference },
        },
      );
    });
  }
}
