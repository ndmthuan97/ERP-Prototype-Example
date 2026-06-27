// =============================================================================
// UPDATE SALES RETURN STATUS COMMAND — Approve, reject, receive goods, complete
// =============================================================================
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';

import {
  SALES_RETURN_REPOSITORY,
  type ISalesReturnRepository,
} from '../../domain/repositories/index.js';

type ReturnAction = 'approve' | 'reject' | 'receive_goods' | 'complete';

@Injectable()
export class UpdateSalesReturnStatusCommand {
  constructor(
    @Inject(SALES_RETURN_REPOSITORY) private readonly repo: ISalesReturnRepository,
  ) {}

  async execute(returnId: string, action: ReturnAction) {
    const salesReturn = await this.repo.findById(returnId);
    if (!salesReturn) {
      throw new NotFoundException(`Sales return "${returnId}" not found`);
    }

    switch (action) {
      case 'approve':
        salesReturn.approve();
        break;
      case 'reject':
        salesReturn.reject();
        break;
      case 'receive_goods':
        salesReturn.receiveGoods();
        break;
      case 'complete':
        salesReturn.complete();
        break;
      default:
        throw new BadRequestException(`Invalid action "${action}"`);
    }

    return this.repo.update(salesReturn);
  }
}
