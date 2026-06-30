// =============================================================================
// ORDER HEADER ENTITY — Aggregate Root của bounded context "Order"
// =============================================================================
// Quản lý toàn bộ lifecycle đơn hàng:
//   draft → submitted → confirmed → partially_delivered → fully_delivered
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
  | 'partially_delivered'
  | 'fully_delivered'
  | 'cancelled';

/** Domain error: action not allowed for current status */
export class InvalidStatusTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`Cannot "${action}" when order is in "${from}" status`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/** Domain error: order has no line items (cannot submit) */
export class EmptyOrderError extends Error {
  constructor() {
    super('Cannot submit order with no line items');
    this.name = 'EmptyOrderError';
  }
}

export interface SalesOrderProps {
  id: string;
  customerId: string;
  status: SalesOrderStatus;
  subtotalAmount: number;
  totalTaxAmount: number;
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
  private _status: SalesOrderStatus;
  private _subtotalAmount: number;
  private _totalTaxAmount: number;
  private _totalAmount: number;
  private _cancelReason: string | null;
  readonly version: number;
  private _lines: SalesOrderLine[];
  readonly createdAt: Date;
  updatedAt: Date;

  get status(): SalesOrderStatus { return this._status; }
  get subtotalAmount(): number { return this._subtotalAmount; }
  get totalTaxAmount(): number { return this._totalTaxAmount; }
  get totalAmount(): number { return this._totalAmount; }
  get cancelReason(): string | null { return this._cancelReason; }

  constructor(props: SalesOrderProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this._status = props.status;
    this._subtotalAmount = props.subtotalAmount;
    this._totalTaxAmount = props.totalTaxAmount;
    this._totalAmount = props.totalAmount;
    this._cancelReason = props.cancelReason;
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
    if (this._status !== 'draft') {
      throw new InvalidStatusTransitionError(this._status, 'addLine');
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
    if (this._status !== 'draft') {
      throw new InvalidStatusTransitionError(this._status, 'submit');
    }
    if (this._lines.length === 0) {
      throw new EmptyOrderError();
    }
    this._status = 'submitted';
    this.touch();
  }

  /**
   * Xác nhận đơn hàng: submitted → confirmed.
   * Gọi sau khi saga hoàn tất (inventory reserved + credit OK).
   */
  confirm(): void {
    if (this._status !== 'submitted') {
      throw new InvalidStatusTransitionError(this._status, 'confirm');
    }
    this._status = 'confirmed';
    this.touch();
  }

  /**
   * Record a delivery event. When a DeliveryOrder is delivered,
   * check if all lines have been fully delivered.
   * confirmed → partially_delivered → fully_delivered
   * @param allLinesDelivered - true when all SO lines are fully delivered
   */
  recordDelivery(allLinesDelivered: boolean): void {
    const allowed: SalesOrderStatus[] = ['confirmed', 'partially_delivered'];
    if (!allowed.includes(this._status)) {
      throw new InvalidStatusTransitionError(this._status, 'recordDelivery');
    }
    if (allLinesDelivered) {
      this.markFullyDelivered();
    } else {
      this._status = 'partially_delivered';
      this.touch();
    }
  }

  private markFullyDelivered(): void {
    this._status = 'fully_delivered';
    this.touch();
  }

  /**
   * Hủy đơn hàng với lý do. Cho phép cancel từ: draft, confirmed.
   * KHÔNG cho cancel fulfilled (đã hoàn tất giao hàng).
   * submitted → saga đang xử lý, cancel qua saga compensation.
   */
  cancel(reason: string): void {
    const cancellable: SalesOrderStatus[] = ['draft', 'confirmed', 'partially_delivered'];
    if (!cancellable.includes(this._status)) {
      throw new InvalidStatusTransitionError(this._status, 'cancel');
    }
    this._status = 'cancelled';
    this._cancelReason = reason;
    this.touch();
  }

  /**
   * Compensation: mark as failed due to insufficient stock.
   * submitted → cancelled.
   */
  markFailedNoStock(): void {
    if (this._status !== 'submitted') {
      throw new InvalidStatusTransitionError(this._status, 'markFailedNoStock');
    }
    this._status = 'cancelled';
    this._cancelReason = 'Insufficient stock (inventory reservation failed)';
    this.touch();
  }

  /**
   * Compensation: mark as failed due to insufficient credit.
   * submitted → cancelled.
   */
  markFailedCredit(reason: string): void {
    if (this._status !== 'submitted') {
      throw new InvalidStatusTransitionError(this._status, 'markFailedCredit');
    }
    this._status = 'cancelled';
    this._cancelReason = reason;
    this.touch();
  }

  /** Recalculate subtotal, tax, and total from pre-calculated line values */
  private recalculateTotals(): void {
    this._subtotalAmount = this._lines.reduce(
      (sum, line) => sum + (line.lineTotal - line.taxAmount),
      0,
    );
    this._totalTaxAmount = this._lines.reduce(
      (sum, line) => sum + line.taxAmount,
      0,
    );
    this._totalAmount = this._subtotalAmount + this._totalTaxAmount;
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  toJSON() {
    return {
      id: this.id,
      customerId: this.customerId,
      status: this._status,
      subtotalAmount: this._subtotalAmount,
      totalTaxAmount: this._totalTaxAmount,
      totalAmount: this._totalAmount,
      cancelReason: this._cancelReason,
      version: this.version,
      lines: this._lines,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
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
      subtotalAmount: 0,
      totalTaxAmount: 0,
      totalAmount: 0,
      cancelReason: null,
      version: 0,
      lines: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
