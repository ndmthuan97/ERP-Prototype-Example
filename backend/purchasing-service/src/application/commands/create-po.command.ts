// =============================================================================
// CREATE PO COMMAND — Create a new draft purchase order
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { PurchaseOrder } from '../../domain/entities/index.js';
import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
} from '../../domain/repositories/index.js';
import { validateCreatePO } from '../dtos/index.js';

@Injectable()
export class CreatePOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
  ) {}

  async execute(dto: unknown): Promise<PurchaseOrder> {
    const validated = validateCreatePO(dto);
    const order = PurchaseOrder.createDraft(uuidv4(), validated.supplierId);
    return this.repo.create(order);
  }
}
