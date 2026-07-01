// =============================================================================
// GET PO QUERY — Fetch a single purchase order with its lines
// =============================================================================
import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import { PurchaseOrder } from "../../domain/entities/index.js";
import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from "../../domain/repositories/index.js";

@Injectable()
export class GetPOQuery {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(id: string): Promise<PurchaseOrder> {
    const order = await this.repo.findById(id);
    if (!order) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }
    return order;
  }
}
