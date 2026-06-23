import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetLifecycleQuery {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY) private readonly repo: ISalesOrderRepository,
  ) {}

  /** CQRS Read: lấy timeline chuyển trạng thái */
  async execute(orderId: string) {
    const order = await this.repo.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Đơn hàng "${orderId}" không tồn tại`);
    }

    const entries = await this.repo.getLifecycle(orderId);

    return {
      orderId: order.id,
      currentStatus: order.status,
      timeline: entries.map((e) => ({
        status: e.toStatus,
        timestamp: e.changedAt.toISOString(),
        actor: e.changedBy,
        note: e.reason ?? `Status changed to ${e.toStatus}`,
      })),
    };
  }
}
