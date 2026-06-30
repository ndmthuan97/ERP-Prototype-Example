// =============================================================================
// PURCHASE ORDER ENTITY — Aggregate Root of "Purchasing" bounded context
// =============================================================================
// State machine: Draft → Placed → PartiallyReceived → Received
//                Draft/Placed → Cancelled
//
// Aggregate boundary: PurchaseOrderLine MUST go through PurchaseOrder methods.
// No one may create/modify lines directly — ensures totalCost stays in sync.

import { AggregateRoot, type DomainEvent } from '@erp/shared';
import { PurchaseOrderLine } from './purchase-order-line.entity.js';
import {
  InvalidPOStatusError,
  LineNotFoundError,
  EmptyPurchaseOrderError,
} from './errors.js';

export type PurchaseOrderStatus =
  | 'draft'
  | 'placed'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderProps {
  id: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  version: number;
  lines: PurchaseOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GoodsReceipt {
  lineId: string;
  quantity: number;
}

export class PurchaseOrder extends AggregateRoot {
  readonly id: string;
  readonly supplierId: string;
  status: PurchaseOrderStatus;
  version: number;
  private _lines: PurchaseOrderLine[];
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PurchaseOrderProps) {
    super();
    this.id = props.id;
    this.supplierId = props.supplierId;
    this.status = props.status;
    this.version = props.version;
    this._lines = [...props.lines];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lines(): readonly PurchaseOrderLine[] {
    return this._lines;
  }

  // ==========================================================================
  // BUSINESS METHODS
  // ==========================================================================

  /**
   * Add a line to the purchase order — draft only.
   * Auto recalculates via the lines array.
   */
  addLine(line: PurchaseOrderLine): void {
    if (this.status !== 'draft') {
      throw new InvalidPOStatusError(this.status, 'add line');
    }
    this._lines.push(line);
    this.touch();
  }

  /**
   * Remove a line from the purchase order — draft only.
   * @throws LineNotFoundError if line doesn't exist
   */
  removeLine(lineId: string): void {
    if (this.status !== 'draft') {
      throw new InvalidPOStatusError(this.status, 'remove line');
    }
    const index = this._lines.findIndex((l) => l.id === lineId);
    if (index === -1) {
      throw new LineNotFoundError(lineId);
    }
    this._lines.splice(index, 1);
    this.touch();
  }

  /**
   * Place the purchase order: draft → placed.
   * Invariant: must have at least 1 line.
   * Raises purchase-order.placed domain event.
   */
  place(): void {
    if (this.status !== 'draft') {
      throw new InvalidPOStatusError(this.status, 'place');
    }
    if (this._lines.length === 0) {
      throw new EmptyPurchaseOrderError();
    }
    this.status = 'placed';
    this.touch();

    this.addDomainEvent({
      eventType: 'purchase-order.placed',
      occurredAt: new Date(),
      payload: {
        orderId: this.id,
        supplierId: this.supplierId,
        totalCost: this.totalCost(),
        lineCount: this._lines.length,
      },
    });
  }

  /**
   * Receive goods against the purchase order.
   * Only allowed from placed or partially_received status.
   * After receiving:
   *   - If all lines fully received → status = 'received'
   *   - Otherwise → status = 'partially_received'
   * Raises goods.received domain event.
   *
   * @throws InvalidPOStatusError if not placed/partially_received
   * @throws LineNotFoundError if a receipt references unknown line
   * @throws OverReceiveError if receivedQty would exceed orderedQty
   */
  receiveGoods(receipts: GoodsReceipt[]): void {
    const receivableStatuses: PurchaseOrderStatus[] = [
      'placed',
      'partially_received',
    ];
    if (!receivableStatuses.includes(this.status)) {
      throw new InvalidPOStatusError(this.status, 'receive goods');
    }

    for (const receipt of receipts) {
      const line = this._lines.find((l) => l.id === receipt.lineId);
      if (!line) {
        throw new LineNotFoundError(receipt.lineId);
      }
      line.receive(receipt.quantity);
    }

    const allReceived = this._lines.every((l) => l.isFullyReceived());
    this.status = allReceived ? 'received' : 'partially_received';
    this.touch();

    this.addDomainEvent({
      eventType: 'goods.received',
      occurredAt: new Date(),
      payload: {
        orderId: this.id,
        supplierId: this.supplierId,
        receipts: receipts.map((r) => {
          const line = this._lines.find((l) => l.id === r.lineId)!;
          return {
            lineId: r.lineId,
            productId: line.productId,
            sku: '',
            quantity: r.quantity,
          };
        }),
        newStatus: this.status,
      },
    });
  }

  /**
   * Cancel the purchase order: draft/placed → cancelled.
   * @param reason Optional cancellation reason
   */
  cancel(reason?: string): void {
    const cancellable: PurchaseOrderStatus[] = ['draft', 'placed'];
    if (!cancellable.includes(this.status)) {
      throw new InvalidPOStatusError(this.status, 'cancel');
    }
    this.status = 'cancelled';
    this.touch();

    this.addDomainEvent({
      eventType: 'purchase-order.cancelled',
      occurredAt: new Date(),
      payload: {
        orderId: this.id,
        reason: reason ?? null,
      },
    });
  }

  /** Update updatedAt and increment version (optimistic locking) */
  touch(): void {
    this.updatedAt = new Date();
    this.version += 1;
  }

  /** Total cost = sum of orderedQty × unitCost per line */
  totalCost(): number {
    return this._lines.reduce((sum, line) => sum + line.lineTotal(), 0);
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  toJSON() {
    return {
      id: this.id,
      supplierId: this.supplierId,
      status: this.status,
      version: this.version,
      lines: this._lines,
      totalCost: this.totalCost(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // ==========================================================================
  // FACTORY
  // ==========================================================================

  /** Create a new purchase order in draft status */
  static createDraft(id: string, supplierId: string): PurchaseOrder {
    const now = new Date();
    return new PurchaseOrder({
      id,
      supplierId,
      status: 'draft',
      version: 0,
      lines: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
