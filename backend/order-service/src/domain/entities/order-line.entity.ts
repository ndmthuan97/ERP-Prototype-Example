// =============================================================================
// ORDER LINE ENTITY — Child entity thuộc Aggregate Root OrderHeader
// =============================================================================
// KHÔNG tạo trực tiếp — phải qua OrderHeader.addLine().
// Snapshot pattern: itemName copy tại thời điểm tạo order line. Nếu item đổi
// tên sau đó, đơn hàng cũ vẫn giữ tên cũ → đảm bảo tính chính xác lịch sử.

export interface OrderLineProps {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: Date;
}

export class OrderLine {
  readonly id: string;
  readonly itemId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly createdAt: Date;

  constructor(props: OrderLineProps) {
    this.id = props.id;
    this.itemId = props.itemId;
    this.itemName = props.itemName;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.lineTotal = props.lineTotal;
    this.createdAt = props.createdAt;
  }

  /**
   * Factory method: tạo line mới với lineTotal = quantity × unitPrice.
   * Validate đầu vào: quantity phải là số nguyên > 0, unitPrice > 0.
   */
  static create(
    id: string,
    itemId: string,
    itemName: string,
    quantity: number,
    unitPrice: number,
  ): OrderLine {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Số lượng phải là số nguyên dương');
    }
    if (unitPrice <= 0) {
      throw new Error('Đơn giá phải là số dương');
    }
    const lineTotal = quantity * unitPrice;
    return new OrderLine({
      id,
      itemId,
      itemName,
      quantity,
      unitPrice,
      lineTotal,
      createdAt: new Date(),
    });
  }
}
