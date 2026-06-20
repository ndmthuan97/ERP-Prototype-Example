import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateCreateItem } from '../dtos/index.js';

@Injectable()
export class CreateItemCommand {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Tạo mặt hàng mới. Trùng SKU → ConflictException (P2002 ở repo).
   * @throws ZodError (→ 400) nếu dữ liệu sai
   */
  async execute(dto: unknown): Promise<StockItem> {
    const data = validateCreateItem(dto);
    const now = new Date();
    const item = new StockItem({
      id: uuidv4(),
      sku: data.sku,
      name: data.name,
      quantityAvailable: data.initialQuantity ?? 0,
      quantityReserved: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    return this.repo.create(item);
  }
}
