import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EVENT } from '@erp/shared';

import {
  StockItem,
  InsufficientStockError,
} from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateReserveStock } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

export interface ReserveResult {
  item: StockItem;
  reservationId: string;
}

@Injectable()
export class ReserveStockCommand {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Giữ chỗ tồn kho cho 1 đơn hàng (saga). Optimistic lock + retry.
   * Thành công → outbox event `inventory.reserved`.
   * Không đủ tồn → ConflictException (409).
   *
   * @throws NotFoundException nếu SKU không tồn tại
   * @throws ConflictException nếu không đủ tồn kho
   */
  async execute(sku: string, dto: unknown): Promise<ReserveResult> {
    const { orderId, quantity } = validateReserveStock(dto);
    const reservationId = uuidv4();

    try {
      const item = await withOptimisticRetry(async () => {
        const found = await this.repo.findBySku(sku);
        if (!found) {
          throw new NotFoundException(`Không tìm thấy mặt hàng SKU "${sku}"`);
        }
        found.reserve(quantity); // ném InsufficientStockError nếu thiếu
        return this.repo.updateWithLock(found, {
          eventType: EVENT.INVENTORY_RESERVED,
          payload: { orderId, reservationId },
        });
      });
      return { item, reservationId };
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
