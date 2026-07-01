// =============================================================================
// ADD LINE PO COMMAND — Add a line to an existing draft PO
// =============================================================================
import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { PurchaseOrderLine } from "../../domain/entities/index.js";
import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from "../../domain/repositories/index.js";
import { validateAddLinePO } from "../dtos/index.js";

@Injectable()
export class AddLinePOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(headerId: string, dto: unknown) {
    const validated = validateAddLinePO(dto);

    const order = await this.repo.findById(headerId);
    if (!order) {
      throw new NotFoundException(`Purchase order "${headerId}" not found`);
    }

    const line = PurchaseOrderLine.create(
      uuidv4(),
      validated.productId,
      validated.productName,
      validated.orderedQty,
      validated.unitCost,
    );

    order.addLine(line);
    return this.repo.addLine(order);
  }
}
