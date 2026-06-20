import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EVENT } from '@erp/shared';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateReleaseStock } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

export interface ReleaseResult {
  item: StockItem;
  reservationId: string;
}

@Injectable()
export class ReleaseStockCommand {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Nhả giữ chỗ (đơn hủy / saga compensation). Optimistic lock + retry.
   * → outbox event `inventory.released`.
   *
   * @throws NotFoundException nếu SKU không tồn tại
   */
  async execute(sku: string, dto: unknown): Promise<ReleaseResult> {
    const { orderId, quantity } = validateReleaseStock(dto);
    const reservationId = uuidv4();

    const item = await withOptimisticRetry(async () => {
      const found = await this.repo.findBySku(sku);
      if (!found) {
        throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
      }
      found.release(quantity);
      return this.repo.updateWithLock(found, {
        eventType: EVENT.INVENTORY_RELEASED,
        payload: { orderId, reservationId },
      });
    });

    return { item, reservationId };
  }
}
