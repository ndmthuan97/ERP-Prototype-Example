// =============================================================================
// GET SALES RETURNS QUERY — List returns for a sales order
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';

import {
  SALES_RETURN_REPOSITORY,
  type ISalesReturnRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetSalesReturnsQuery {
  constructor(
    @Inject(SALES_RETURN_REPOSITORY) private readonly repo: ISalesReturnRepository,
  ) {}

  async execute(salesOrderId: string) {
    return this.repo.findBySalesOrderId(salesOrderId);
  }
}
