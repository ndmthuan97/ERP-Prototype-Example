// =============================================================================
// SALES RETURN REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { SalesReturn } from '../entities/sales-return.entity.js';

export const SALES_RETURN_REPOSITORY = 'SALES_RETURN_REPOSITORY';

export interface ISalesReturnRepository {
  findById(id: string): Promise<SalesReturn | null>;
  findBySalesOrderId(salesOrderId: string): Promise<SalesReturn[]>;

  /** Create a new sales return with its lines */
  create(salesReturn: SalesReturn): Promise<SalesReturn>;

  /** Update sales return status */
  update(salesReturn: SalesReturn): Promise<SalesReturn>;
}
