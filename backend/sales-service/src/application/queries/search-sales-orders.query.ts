import { Injectable, Inject } from '@nestjs/common';

import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { validateSearchOrders } from '../dtos/index.js';

@Injectable()
export class SearchSalesOrdersQuery {
  constructor(
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly repo: ISalesOrderRepository,
  ) {}

  /** Tìm kiếm đơn hàng với phân trang + filter status */
  async execute(params: { page?: string; limit?: string; status?: string }) {
    const parsed = validateSearchOrders({
      page: params.page ? parseInt(params.page, 10) : undefined,
      limit: params.limit ? parseInt(params.limit, 10) : undefined,
      status: params.status || undefined,
    });

    const result = await this.repo.search({
      status: parsed.status,
      page: parsed.page,
      limit: parsed.limit,
    });

    return {
      data: result.data.map((order) => ({
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }
}
