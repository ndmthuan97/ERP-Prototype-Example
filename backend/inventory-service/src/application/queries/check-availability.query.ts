import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';

export interface AvailabilityResult {
  sku: string;
  available: number;
  reserved: number;
  total: number;
  /** Có đủ để giữ chỗ `quantity` không (nếu truyền) */
  canReserve: boolean;
}

@Injectable()
export class CheckAvailabilityQuery {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Order Service gọi để kiểm tra tồn kho trước khi submit.
   * @param quantity số lượng cần kiểm tra (mặc định 1)
   */
  async execute(sku: string, quantity = 1): Promise<AvailabilityResult> {
    const item = await this.repo.findBySku(sku);
    if (!item) {
      throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
    }
    return {
      sku: item.sku,
      available: item.quantityAvailable,
      reserved: item.quantityReserved,
      total: item.totalQuantity(),
      canReserve: item.canReserve(quantity),
    };
  }
}
