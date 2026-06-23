// =============================================================================
// ORDER HEADER ENTITY — Aggregate Root của bounded context "Order"
// =============================================================================
// Quản lý toàn bộ lifecycle đơn hàng:
//   draft → submitted → confirmed → fulfilled
//                    ↘ cancelled (compensation)
//   draft / confirmed → cancelled (manual)
//
// Aggregate boundary: SalesOrderLine PHẢI đi qua SalesOrder (addLine). Không ai
// được tạo/sửa/xóa SalesOrderLine trực tiếp — đảm bảo invariant totalAmount luôn
// đồng bộ với tổng lineTotal.

import { SalesOrderLine } from './sales-order-line.entity.js';

export type SalesOrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled';

/** Lỗi domain: hành động không hợp lệ cho trạng thái hiện tại */
export class InvalidStatusTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`Không thể "${action}" khi đơn hàng đang ở trạng thái "${from}"`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/** Lỗi domain: đơn hàng chưa có dòng hàng (không thể submit) */
export class EmptyOrderError extends Error {
  constructor() {
    super('Không thể submit đơn hàng chưa có dòng hàng');
    this.name = 'EmptyOrderError';
  }
}

export interface SalesOrderProps {
  id: string;
  customerId: string;
  status: SalesOrderStatus;
  totalAmount: number;
  cancelReason: string | null;
  version: number;
  lines: SalesOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}

export class SalesOrder {
  readonly id: string;
  readonly customerId: string;
  status: SalesOrderStatus;
  totalAmount: number;
  cancelReason: string | null;
  readonly version: number;
  private _lines: SalesOrderLine[];
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: SalesOrderProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this.status = props.status;
    this.totalAmount = props.totalAmount;
    this.cancelReason = props.cancelReason;
    this.version = props.version;
    this._lines = props.lines;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lines(): readonly SalesOrderLine[] {
    return this._lines;
  }

  // ==========================================================================
  // BUSINESS METHODS
  // ==========================================================================

  /**
   * Thêm dòng hàng vào đơn — CHỈ khi status = draft.
   * Auto recalculate totalAmount.
   */
  addLine(line: SalesOrderLine): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'thêm dòng hàng');
    }
    this._lines.push(line);
    this.recalculateTotals();
    this.touch();
  }

  /**
   * Submit đơn hàng: draft → submitted.
   * Validate: phải có ít nhất 1 dòng hàng.
   * @throws EmptyOrderError nếu chưa có line
   * @throws InvalidStatusTransitionError nếu không phải draft
   */
  submit(): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'submit');
    }
    if (this._lines.length === 0) {
      throw new EmptyOrderError();
    }
    this.status = 'submitted';
    this.touch();
  }

  /**
   * Xác nhận đơn hàng: submitted → confirmed.
   * Gọi sau khi saga hoàn tất (inventory reserved + credit OK).
   */
  confirm(): void {
    if (this.status !== 'submitted') {
      throw new InvalidStatusTransitionError(this.status, 'confirm');
    }
    this.status = 'confirmed';
    this.touch();
  }

  /**
   * Fulfil order: confirmed → fulfilled.
   * Called when goods have been shipped/delivered successfully.
   */
  fulfil(): void {
    if (this.status !== 'confirmed') {
      throw new InvalidStatusTransitionError(this.status, 'fulfilled');
    }
    this.status = 'fulfilled';
    this.touch();
  }

  /**
   * Hủy đơn hàng với lý do. Cho phép cancel từ: draft, confirmed.
   * KHÔNG cho cancel fulfilled (đã hoàn tất giao hàng).
   * submitted → saga đang xử lý, cancel qua saga compensation.
   */
  cancel(reason: string): void {
    const cancellable: SalesOrderStatus[] = ['draft', 'confirmed'];
    if (!cancellable.includes(this.status)) {
      throw new InvalidStatusTransitionError(this.status, 'cancel');
    }
    this.status = 'cancelled';
    this.cancelReason = reason;
    this.touch();
  }

  /**
   * Saga compensation: đánh dấu thất bại do không đủ tồn kho.
   * submitted → cancelled.
   */
  markFailedNoStock(): void {
    if (this.status !== 'submitted') {
      throw new InvalidStatusTransitionError(this.status, 'markFailedNoStock');
    }
    this.status = 'cancelled';
    this.cancelReason = 'Không đủ tồn kho (inventory reservation failed)';
    this.touch();
  }

  /**
   * Saga compensation: đánh dấu thất bại do credit không đủ.
   * submitted → cancelled.
   */
  markFailedCredit(reason: string): void {
    if (this.status !== 'submitted') {
      throw new InvalidStatusTransitionError(this.status, 'markFailedCredit');
    }
    this.status = 'cancelled';
    this.cancelReason = reason;
    this.touch();
  }

  /** Tính lại totalAmount = Σ(line.lineTotal) */
  private recalculateTotals(): void {
    this.totalAmount = this._lines.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  // ==========================================================================
  // FACTORY
  // ==========================================================================

  /** Tạo đơn hàng mới ở trạng thái draft */
  static createDraft(id: string, customerId: string): SalesOrder {
    const now = new Date();
    return new SalesOrder({
      id,
      customerId,
      status: 'draft',
      totalAmount: 0,
      cancelReason: null,
      version: 0,
      lines: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
