// =============================================================================
// STOCK ITEM REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { StockItem } from '../entities/index.js';

export const STOCK_ITEM_REPOSITORY = 'STOCK_ITEM_REPOSITORY';

/** Lỗi optimistic lock: bản ghi đã bị 1 transaction khác cập nhật (version lệch) */
export class OptimisticLockError extends Error {
  constructor(id: string) {
    super(
      `Optimistic lock conflict cho StockItem "${id}" — version đã thay đổi`,
    );
    this.name = 'OptimisticLockError';
  }
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Event ghi vào outbox CÙNG transaction với thay đổi business (Outbox Pattern) */
export interface OutboxEventInput {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface IStockItemRepository {
  findById(id: string): Promise<StockItem | null>;
  findBySku(sku: string): Promise<StockItem | null>;
  search(
    query: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<StockItem>>;

  /** INSERT mặt hàng mới (+ outbox event tùy chọn) trong 1 transaction */
  create(item: StockItem, event?: OutboxEventInput): Promise<StockItem>;

  /**
   * UPDATE với OPTIMISTIC LOCKING: chỉ ghi khi version DB == version entity,
   * đồng thời version+1. Nếu 0 row affected → @throws OptimisticLockError.
   * Ghi outbox event (nếu có) trong cùng transaction.
   */
  updateWithLock(item: StockItem, event?: OutboxEventInput): Promise<StockItem>;
}
