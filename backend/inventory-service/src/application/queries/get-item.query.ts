import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetItemQuery {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  async execute(sku: string): Promise<StockItem> {
    const item = await this.repo.findBySku(sku);
    if (!item) {
      throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
    }
    return item;
  }
}
