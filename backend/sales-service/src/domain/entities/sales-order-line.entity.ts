// =============================================================================
// ORDER LINE ENTITY — Child entity thuộc Aggregate Root SalesOrder
// =============================================================================
// KHÔNG tạo trực tiếp — phải qua SalesOrder.addLine().
// Snapshot pattern: itemName copy tại thời điểm tạo order line. Nếu item đổi
// tên sau đó, đơn hàng cũ vẫn giữ tên cũ → đảm bảo tính chính xác lịch sử.

export interface SalesOrderLineProps {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  createdAt: Date;
}

export class SalesOrderLine {
  readonly id: string;
  readonly itemId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly createdAt: Date;

  constructor(props: SalesOrderLineProps) {
    this.id = props.id;
    this.itemId = props.itemId;
    this.itemName = props.itemName;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.taxRate = props.taxRate;
    this.taxAmount = props.taxAmount;
    this.lineTotal = props.lineTotal;
    this.createdAt = props.createdAt;
  }

  /**
   * Factory method: create a new line with tax calculation.
   * subtotal = quantity × unitPrice
   * taxAmount = subtotal × taxRate
   * lineTotal = subtotal + taxAmount
   */
  static create(
    id: string,
    itemId: string,
    itemName: string,
    quantity: number,
    unitPrice: number,
    taxRate: number = 0,
  ): SalesOrderLine {
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error('Quantity must be a positive number');
    }
    if (
      typeof unitPrice !== 'number' ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw new Error('Unit price must not be negative');
    }
    const subtotal = Math.round(quantity * unitPrice);
    const taxAmount = Math.round(subtotal * taxRate);
    const lineTotal = subtotal + taxAmount;
    return new SalesOrderLine({
      id,
      itemId,
      itemName,
      quantity,
      unitPrice,
      taxRate,
      taxAmount,
      lineTotal,
      createdAt: new Date(),
    });
  }
}
