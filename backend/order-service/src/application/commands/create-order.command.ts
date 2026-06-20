import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { OrderHeader } from '../../domain/entities/index.js';
import {
  ORDER_REPOSITORY,
  type IOrderRepository,
} from '../../domain/repositories/index.js';
import { validateCreateOrder } from '../dtos/index.js';

@Injectable()
export class CreateOrderCommand {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repo: IOrderRepository,
  ) {}

  /**
   * Tạo đơn hàng mới ở trạng thái draft.
   * Chỉ cần customerId — chưa validate customer tồn tại (chưa có auth/gateway).
   */
  async execute(dto: unknown): Promise<OrderHeader> {
    const { customerId } = validateCreateOrder(dto);
    const order = OrderHeader.createDraft(uuidv4(), customerId);
    return this.repo.create(order);
  }
}
