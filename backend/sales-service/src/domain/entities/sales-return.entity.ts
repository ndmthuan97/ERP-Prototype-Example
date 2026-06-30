// =============================================================================
// SALES RETURN ENTITY — Return/refund for a fulfilled Sales Order
// =============================================================================
// State machine: draft → approved → goods_received → completed
//                draft → rejected
//
// A SalesOrder can have multiple SalesReturns.
// Business rule: Only fulfilled orders can be returned.

import { SalesReturnLine } from './sales-return-line.entity.js';
import { InvalidStatusTransitionError } from './sales-order.entity.js';

export type SalesReturnStatus =
  | 'draft'
  | 'approved'
  | 'goods_received'
  | 'completed'
  | 'rejected';

export interface SalesReturnProps {
  id: string;
  salesOrderId: string;
  customerId: string;
  status: SalesReturnStatus;
  reason: string;
  totalRefundAmount: number;
  lines: SalesReturnLine[];
  approvedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SalesReturn {
  readonly id: string;
  readonly salesOrderId: string;
  readonly customerId: string;
  status: SalesReturnStatus;
  readonly reason: string;
  totalRefundAmount: number;
  private _lines: SalesReturnLine[];
  approvedAt: Date | null;
  completedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: SalesReturnProps) {
    this.id = props.id;
    this.salesOrderId = props.salesOrderId;
    this.customerId = props.customerId;
    this.status = props.status;
    this.reason = props.reason;
    this.totalRefundAmount = props.totalRefundAmount;
    this._lines = [...props.lines];
    this.approvedAt = props.approvedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lines(): readonly SalesReturnLine[] {
    return this._lines;
  }

  addLine(line: SalesReturnLine): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'addLine');
    }
    this._lines.push(line);
    this.recalculateTotal();
    this.touch();
  }

  /** Approve the return: draft → approved */
  approve(): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'approve');
    }
    if (this._lines.length === 0) {
      throw new Error('Cannot approve return with no lines');
    }
    this.status = 'approved';
    this.approvedAt = new Date();
    this.touch();
  }

  /** Reject the return: draft → rejected */
  reject(): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'reject');
    }
    this.status = 'rejected';
    this.touch();
  }

  /** Mark goods as received: approved → goods_received */
  receiveGoods(): void {
    if (this.status !== 'approved') {
      throw new InvalidStatusTransitionError(this.status, 'receiveGoods');
    }
    this.status = 'goods_received';
    this.touch();
  }

  /** Complete the return (refund processed): goods_received → completed */
  complete(): void {
    if (this.status !== 'goods_received') {
      throw new InvalidStatusTransitionError(this.status, 'complete');
    }
    this.status = 'completed';
    this.completedAt = new Date();
    this.touch();
  }

  private recalculateTotal(): void {
    this.totalRefundAmount = this._lines.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );
  }

  toJSON() {
    return {
      id: this.id,
      salesOrderId: this.salesOrderId,
      customerId: this.customerId,
      status: this.status,
      reason: this.reason,
      totalRefundAmount: this.totalRefundAmount,
      lines: this._lines,
      approvedAt: this.approvedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  static createDraft(
    id: string,
    salesOrderId: string,
    customerId: string,
    reason: string,
  ): SalesReturn {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Return reason must not be empty');
    }
    const now = new Date();
    return new SalesReturn({
      id,
      salesOrderId,
      customerId,
      status: 'draft',
      reason: reason.trim(),
      totalRefundAmount: 0,
      lines: [],
      approvedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
