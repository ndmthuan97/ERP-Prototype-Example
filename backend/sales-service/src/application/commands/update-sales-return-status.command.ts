// =============================================================================
// UPDATE SALES RETURN STATUS COMMAND — Approve, reject, receive goods, complete
// =============================================================================
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EVENT, type SalesReturnGoodsReceivedPayload } from '@erp/shared';

import {
  SALES_RETURN_REPOSITORY,
  type ISalesReturnRepository,
  type OutboxEventInput,
} from '../../domain/repositories/index.js';

type ReturnAction = 'approve' | 'reject' | 'receive_goods' | 'complete';

@Injectable()
export class UpdateSalesReturnStatusCommand {
  constructor(
    @Inject(SALES_RETURN_REPOSITORY)
    private readonly repo: ISalesReturnRepository,
  ) {}

  async execute(returnId: string, action: ReturnAction) {
    const salesReturn = await this.repo.findById(returnId);
    if (!salesReturn) {
      throw new NotFoundException(`Sales return "${returnId}" not found`);
    }

    const events: OutboxEventInput[] = [];

    switch (action) {
      case 'approve':
        salesReturn.approve();
        break;
      case 'reject':
        salesReturn.reject();
        break;
      case 'receive_goods':
        salesReturn.receiveGoods();
        // Returned goods are physically back in the warehouse now → tell
        // inventory to restock the returned quantities. Emitted only on this
        // transition (the state machine blocks re-entry, so no double restock).
        events.push({
          eventType: EVENT.SALES_RETURN_GOODS_RECEIVED,
          payload: {
            returnId: salesReturn.id,
            orderId: salesReturn.salesOrderId,
            customerId: salesReturn.customerId,
            lines: salesReturn.lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
            })),
          } satisfies SalesReturnGoodsReceivedPayload,
        });
        break;
      case 'complete':
        salesReturn.complete();
        break;
      default:
        throw new BadRequestException(`Invalid action "${String(action)}"`);
    }

    return this.repo.update(salesReturn, events);
  }
}
