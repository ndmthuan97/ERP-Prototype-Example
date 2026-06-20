// =============================================================================
// ORDER REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { OrderHeader } from '../entities/index.js';

export const ORDER_REPOSITORY = 'ORDER_REPOSITORY';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchOrdersParams {
  status?: string;
  page: number;
  limit: number;
}

/** Event ghi vào outbox CÙNG transaction với thay đổi business (Outbox Pattern) */
export interface OutboxEventInput {
  eventType: string;
  payload: Record<string, unknown>;
}

/** Dữ liệu ghi vào status_history khi chuyển trạng thái */
export interface StatusHistoryInput {
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  reason?: string;
}

/** Dòng trong status_history trả về cho query */
export interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  changedAt: Date;
  reason: string | null;
}

/** Dữ liệu cho upsert lifecycle_view (CQRS read model) */
export interface LifecycleViewData {
  customerName: string;
  status: string;
  totalAmount: number;
  lineCount: number;
  createdAt: Date;
  lastStatusChange: Date;
}

export interface IOrderRepository {
  findById(id: string): Promise<OrderHeader | null>;
  findByIdWithLines(id: string): Promise<OrderHeader | null>;

  search(params: SearchOrdersParams): Promise<PaginatedResult<OrderHeader>>;

  /** INSERT order mới + optional outbox event trong 1 transaction */
  create(order: OrderHeader, event?: OutboxEventInput): Promise<OrderHeader>;

  /**
   * UPDATE order + ghi outbox event(s) + status_history + upsert lifecycle_view
   * trong 1 transaction. Version sẽ auto increment.
   */
  update(
    order: OrderHeader,
    events?: OutboxEventInput[],
    statusEntry?: StatusHistoryInput,
    lifecycleData?: LifecycleViewData,
  ): Promise<OrderHeader>;

  /** Thêm OrderLine vào header + outbox (nếu có) trong 1 transaction */
  addLine(
    order: OrderHeader,
    lifecycleData?: LifecycleViewData,
  ): Promise<OrderHeader>;

  /** Lấy lịch sử chuyển trạng thái (CQRS read — status_history) */
  getLifecycle(orderId: string): Promise<StatusHistoryEntry[]>;
}
