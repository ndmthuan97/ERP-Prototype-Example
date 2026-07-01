// =============================================================================
// PURCHASE ORDER REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { PurchaseOrder } from "../entities/index.js";

export const PURCHASE_ORDER_REPOSITORY = "PURCHASE_ORDER_REPOSITORY";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchPurchaseOrdersParams {
  status?: string;
  page: number;
  limit: number;
}

/** Event to write into outbox within the same transaction */
export interface OutboxEventInput {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface IPurchaseOrderRepository {
  /** Find a PO by ID with its lines */
  findById(id: string): Promise<PurchaseOrder | null>;

  /** Search POs with pagination and optional status filter */
  search(
    params: SearchPurchaseOrdersParams,
  ): Promise<PaginatedResult<PurchaseOrder>>;

  /** Create a new PO (draft) */
  create(order: PurchaseOrder): Promise<PurchaseOrder>;

  /**
   * Save (update) a PO + write outbox events in a single transaction.
   * Uses optimistic locking via version field.
   */
  save(
    order: PurchaseOrder,
    events?: OutboxEventInput[],
  ): Promise<PurchaseOrder>;

  /** Add a line to a PO within a transaction */
  addLine(order: PurchaseOrder): Promise<PurchaseOrder>;

  /** Remove a line from a PO */
  removeLine(orderId: string, lineId: string): Promise<void>;
}
