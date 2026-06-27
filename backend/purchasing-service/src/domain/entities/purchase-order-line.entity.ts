// =============================================================================
// PURCHASE ORDER LINE ENTITY — Child entity of PurchaseOrder aggregate
// =============================================================================
// Must be created/modified via PurchaseOrder aggregate methods.
// Snapshot pattern: productName copied at creation time.

import { OverReceiveError } from './errors.js';

export interface PurchaseOrderLineProps {
  id: string;
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export class PurchaseOrderLine {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly orderedQty: number;
  receivedQty: number;
  readonly unitCost: number;

  constructor(props: PurchaseOrderLineProps) {
    this.id = props.id;
    this.productId = props.productId;
    this.productName = props.productName;
    this.orderedQty = props.orderedQty;
    this.receivedQty = props.receivedQty;
    this.unitCost = props.unitCost;
  }

  /**
   * Receive a quantity of goods for this line.
   * Invariant: receivedQty + qty must not exceed orderedQty.
   */
  receive(qty: number): void {
    const newReceived = this.receivedQty + qty;
    if (newReceived > this.orderedQty) {
      throw new OverReceiveError(this.id, this.orderedQty, newReceived);
    }
    this.receivedQty = newReceived;
  }

  /** Whether this line has been fully received */
  isFullyReceived(): boolean {
    return this.receivedQty >= this.orderedQty;
  }

  /** Total cost = orderedQty × unitCost */
  lineTotal(): number {
    return this.orderedQty * this.unitCost;
  }

  /**
   * Factory: create a new line with receivedQty = 0.
   * Validates orderedQty > 0 and unitCost > 0.
   */
  static create(
    id: string,
    productId: string,
    productName: string,
    orderedQty: number,
    unitCost: number,
  ): PurchaseOrderLine {
    if (typeof orderedQty !== 'number' || !Number.isFinite(orderedQty) || orderedQty <= 0) {
      throw new Error('orderedQty must be a positive number');
    }
    if (unitCost <= 0) {
      throw new Error('unitCost must be a positive number');
    }
    return new PurchaseOrderLine({
      id,
      productId,
      productName,
      orderedQty,
      receivedQty: 0,
      unitCost,
    });
  }
}
