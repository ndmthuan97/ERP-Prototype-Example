// =============================================================================
// PLACE PO COMMAND — Transition draft → placed
// =============================================================================
import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from '../../domain/repositories/index.js';
import { getCorrelationId } from '@erp/shared';

@Injectable()
export class PlacePOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(id: string) {
    const order = await this.repo.findById(id);
    if (!order) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }

    // Domain method: validates draft status + >=1 line, raises domain event
    order.place();

    // Pull domain events for outbox persistence
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
