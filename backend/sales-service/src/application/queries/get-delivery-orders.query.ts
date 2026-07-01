// =============================================================================
// GET DELIVERY ORDERS QUERY — List delivery orders for a sales order
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';

import {
  DELIVERY_ORDER_REPOSITORY,
  type IDeliveryOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetDeliveryOrdersQuery {
  constructor(
    @Inject(DELIVERY_ORDER_REPOSITORY)
    private readonly repo: IDeliveryOrderRepository,
  ) {}

  async execute(salesOrderId: string) {
    return this.repo.findBySalesOrderId(salesOrderId);
  }
}
