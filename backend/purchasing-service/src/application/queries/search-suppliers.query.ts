// =============================================================================
// SEARCH SUPPLIERS QUERY — List suppliers with pagination + search
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';

import {
  SUPPLIER_REPOSITORY,
  type ISupplierRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class SearchSuppliersQuery {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly repo: ISupplierRepository,
  ) {}

  async execute(
    query?: string,
    page?: number,
    limit?: number,
    isActive?: boolean,
  ) {
    const safePage = Math.max(1, page ?? 1);
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));

    return this.repo.findAll({
      query,
      isActive,
      page: safePage,
      limit: safeLimit,
    });
  }
}
