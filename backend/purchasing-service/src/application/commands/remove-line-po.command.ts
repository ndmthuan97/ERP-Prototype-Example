// =============================================================================
// REMOVE LINE PO COMMAND — Remove a line from a draft PO
// =============================================================================
import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from "../../domain/repositories/index.js";

@Injectable()
export class RemoveLinePOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(headerId: string, lineId: string): Promise<void> {
    const order = await this.repo.findById(headerId);
    if (!order) {
      throw new NotFoundException(`Purchase order "${headerId}" not found`);
    }

    // Domain invariant check (draft only + line exists) happens inside entity
    order.removeLine(lineId);
    await this.repo.removeLine(headerId, lineId);
  }
}
