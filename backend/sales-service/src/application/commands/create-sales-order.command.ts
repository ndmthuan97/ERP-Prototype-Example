import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { SalesOrder } from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { validateCreateOrder } from '../dtos/index.js';

@Injectable()
export class CreateSalesOrderCommand {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  /**
   * Tạo đơn hàng mới ở trạng thái draft.
   * Chỉ cần customerId — chưa validate customer tồn tại (chưa có auth/gateway).
   */
  async execute(dto: unknown): Promise<SalesOrder> {
    const { customerId } = validateCreateOrder(dto);
    const order = SalesOrder.createDraft(uuidv4(), customerId);
    return this.repo.create(order);
  }
}
