import { Injectable, Inject } from '@nestjs/common';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
  type PaginatedResult,
} from '../../domain/repositories/index.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class SearchItemsQuery {
  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  async execute(
    query: string = '',
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedResult<StockItem>> {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    return this.repo.search(query.trim(), normalizedPage, normalizedLimit);
  }
}
