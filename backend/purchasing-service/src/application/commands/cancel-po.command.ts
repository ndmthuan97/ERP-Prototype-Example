// =============================================================================
// CANCEL PO COMMAND — Cancel a draft or placed purchase order
// =============================================================================
import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from '../../domain/repositories/index.js';
import { validateCancelPO } from '../dtos/index.js';
import { getCorrelationId } from '@erp/shared';

@Injectable()
export class CancelPOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(id: string, dto?: unknown) {
    const validated = dto ? validateCancelPO(dto) : { reason: undefined };

    const order = await this.repo.findById(id);
    if (!order) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }

    // Domain invariant: only draft/placed can be cancelled
    order.cancel(validated.reason);

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
