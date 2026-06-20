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
   * Nhập kho theo SKU (tăng quantityAvailable). Optimistic lock + retry.
   * @throws NotFoundException nếu SKU không tồn tại
   */
  async execute(sku: string, dto: unknown): Promise<StockItem> {
    const { quantity } = validateReceiveStock(dto);

    return withOptimisticRetry(async () => {
      const item = await this.repo.findBySku(sku);
      if (!item) {
        throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
      }
      item.receive(quantity);
      // Nhập kho là thao tác nội bộ → không phát event saga
      return this.repo.updateWithLock(item);
    });
  }
}
