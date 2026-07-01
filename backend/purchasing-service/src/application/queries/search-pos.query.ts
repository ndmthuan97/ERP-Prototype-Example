// =============================================================================
// SEARCH POs QUERY — Paginated search with optional status filter
// =============================================================================
import { Injectable, Inject } from "@nestjs/common";

import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from "../../domain/repositories/index.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class SearchPOsQuery {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(
    status?: string,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
  ) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

    const result = await this.repo.search({
      status: status || undefined,
      page: normalizedPage,
      limit: normalizedLimit,
    });

    return {
      data: result.data.map((po) => ({
        id: po.id,
        supplierId: po.supplierId,
        status: po.status,
        totalCost: po.totalCost(),
        lineCount: po.lines.length,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
