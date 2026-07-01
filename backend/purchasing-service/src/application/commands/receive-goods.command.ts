// =============================================================================
// RECEIVE GOODS COMMAND — Record goods receipt against a placed PO
// =============================================================================
import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from "../../domain/repositories/index.js";
import { validateReceiveGoods } from "../dtos/index.js";
import { getCorrelationId } from "@erp/shared";

@Injectable()
export class ReceiveGoodsCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(id: string, dto: unknown) {
    const validated = validateReceiveGoods(dto);

    const order = await this.repo.findById(id);
    if (!order) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }

    // Domain method: validates status, updates receivedQty, changes status
    order.receiveGoods(validated.receipts);

    const domainEvents = order.pullDomainEvents();
    const outboxEvents = domainEvents.map((e) => ({
      eventType: e.eventType,
      payload: {
        ...e.payload,
        _meta: {
          correlationId: getCorrelationId() ?? null,
          occurredAt: e.occurredAt.toISOString(),
        },
      },
    }));

    return this.repo.save(order, outboxEvents);
  }
}
