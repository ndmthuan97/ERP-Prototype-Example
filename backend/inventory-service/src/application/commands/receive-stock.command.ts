import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateReceiveStock } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class ReceiveStockCommand {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Receive stock by SKU (increase quantityAvailable). Optimistic lock + retry.
   * Records a StockMovement IN for audit trail.
   * @throws NotFoundException if SKU does not exist
   */
  async execute(sku: string, dto: unknown): Promise<StockItem> {
    const { quantity } = validateReceiveStock(dto);

    return withOptimisticRetry(async () => {
      const item = await this.repo.findBySku(sku);
      if (!item) {
        throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
      }
      item.receive(quantity);
      return this.repo.saveWithMovement(item, {
        itemId: item.id,
        type: 'IN',
        quantity,
        reason: 'purchase_receive',
      });
    });
  }
}
