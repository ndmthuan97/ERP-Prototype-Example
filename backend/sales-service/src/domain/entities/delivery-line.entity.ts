// =============================================================================
// DELIVERY LINE ENTITY — Child entity of DeliveryOrder
// =============================================================================
// Tracks the quantity being delivered per sales order line.

export interface DeliveryLineProps {
  id: string;
  salesOrderLineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
}

export class DeliveryLine {
  readonly id: string;
  readonly salesOrderLineId: string;
  readonly itemId: string;
  readonly itemName: string;
  readonly quantity: number;

  constructor(props: DeliveryLineProps) {
    this.id = props.id;
    this.salesOrderLineId = props.salesOrderLineId;
    this.itemId = props.itemId;
    this.itemName = props.itemName;
    this.quantity = props.quantity;
  }

  static create(
    id: string,
    salesOrderLineId: string,
    itemId: string,
    itemName: string,
    quantity: number,
  ): DeliveryLine {
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error('Delivery quantity must be a positive number');
    }
    return new DeliveryLine({
      id,
      salesOrderLineId,
      itemId,
      itemName,
      quantity,
    });
  }
}
