// =============================================================================
// SALES RETURN REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { SalesReturn } from '../entities/sales-return.entity.js';
import type { OutboxEventInput } from './sales-order.repository.js';

export const SALES_RETURN_REPOSITORY = 'SALES_RETURN_REPOSITORY';

export interface ISalesReturnRepository {
  findById(id: string): Promise<SalesReturn | null>;
  findBySalesOrderId(salesOrderId: string): Promise<SalesReturn[]>;

  /** Create a new sales return with its lines */
  create(salesReturn: SalesReturn): Promise<SalesReturn>;

  /**
   * Update sales return status. Optional outbox events are written in the SAME
   * transaction as the status change (e.g. sales-return.goods-received so
   * inventory restocks the returned quantities).
   */
  update(
    salesReturn: SalesReturn,
    events?: OutboxEventInput[],
  ): Promise<SalesReturn>;
}
