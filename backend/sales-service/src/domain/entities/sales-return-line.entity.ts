// =============================================================================
// SALES RETURN LINE ENTITY — Child entity of SalesReturn
// =============================================================================
// Tracks the quantity being returned per sales order line.

export interface SalesReturnLineProps {
  id: string;
  salesOrderLineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  reason: string | null;
}

export class SalesReturnLine {
  readonly id: string;
  readonly salesOrderLineId: string;
  readonly itemId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly reason: string | null;

  constructor(props: SalesReturnLineProps) {
    this.id = props.id;
    this.salesOrderLineId = props.salesOrderLineId;
    this.itemId = props.itemId;
    this.itemName = props.itemName;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.reason = props.reason;
  }

  get lineTotal(): number {
    return this.quantity * this.unitPrice;
  }

  static create(
    id: string,
    salesOrderLineId: string,
    itemId: string,
    itemName: string,
    quantity: number,
    unitPrice: number,
    reason?: string,
  ): SalesReturnLine {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Return quantity must be a positive number');
    }
    return new SalesReturnLine({
      id,
      salesOrderLineId,
      itemId,
      itemName,
      quantity,
      unitPrice,
      reason: reason ?? null,
    });
  }
}
