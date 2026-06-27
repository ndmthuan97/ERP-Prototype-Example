// =============================================================================
// STOCK ITEM ENTITY — Aggregate Root của bounded context "Inventory"
// =============================================================================
// Quản lý tồn kho 1 mặt hàng (SKU). Business rule cốt lõi: reserve/release/receive
// luôn giữ invariant: quantityAvailable >= 0, quantityReserved >= 0.
//
// `version` phục vụ Optimistic Locking ở tầng persistence (không tăng trong entity;
// repository so khớp + tăng version khi UPDATE).

/** Domain error: insufficient stock for reservation */
export class InsufficientStockError extends Error {
  constructor(sku: string, requested: number, available: number) {
    super(
      `Insufficient stock for SKU "${sku}": requested ${requested}, available ${available}`,
    );
    this.name = 'InsufficientStockError';
  }
}

export interface StockItemProps {
  id: string;
  sku: string;
  name: string;
  quantityAvailable: number;
  quantityReserved: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class StockItem {
  readonly id: string;
  readonly sku: string;
  private _name: string;
  private _quantityAvailable: number;
  private _quantityReserved: number;
  readonly version: number;
  readonly createdAt: Date;
  updatedAt: Date;

  get name(): string { return this._name; }
  get quantityAvailable(): number { return this._quantityAvailable; }
  get quantityReserved(): number { return this._quantityReserved; }

  constructor(props: StockItemProps) {
    this.id = props.id;
    this.sku = props.sku;
    this._name = props.name;
    this._quantityAvailable = props.quantityAvailable;
    this._quantityReserved = props.quantityReserved;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  // ==========================================================================
  // BUSINESS METHODS
  // ==========================================================================

  /**
   * Nhập kho — tăng số lượng khả dụng.
   * @throws Error nếu quantity <= 0
   */
  receive(quantity: number): void {
    this.assertPositive(quantity);
    this._quantityAvailable += quantity;
    this.touch();
  }

  /**
   * Giữ chỗ (reserve) cho 1 đơn hàng: available → reserved.
   * @throws InsufficientStockError nếu không đủ khả dụng.
   */
  reserve(quantity: number): void {
    this.assertPositive(quantity);
    if (this._quantityAvailable < quantity) {
      throw new InsufficientStockError(
        this.sku,
        quantity,
        this._quantityAvailable,
      );
    }
    this._quantityAvailable -= quantity;
    this._quantityReserved += quantity;
    this.touch();
  }

  /**
   * Nhả giữ chỗ (release): reserved → available. Dùng khi đơn bị hủy.
   * Không nhả quá số đang giữ (kẹp về 0 để giữ invariant).
   */
  release(quantity: number): void {
    this.assertPositive(quantity);
    const releasable = Math.min(quantity, this._quantityReserved);
    this._quantityReserved -= releasable;
    this._quantityAvailable += releasable;
    this.touch();
  }

  /**
   * Issue stock — reduce available quantity (outbound shipment).
   * If reserved stock is being fulfilled, also reduce reserved accordingly.
   * @throws InsufficientStockError if not enough available stock
   */
  issue(quantity: number, reference?: string): void {
    this.assertPositive(quantity);
    if (this._quantityAvailable < quantity) {
      throw new InsufficientStockError(
        this.sku,
        quantity,
        this._quantityAvailable,
      );
    }
    this._quantityAvailable -= quantity;
    const reservedToRelease = Math.min(this._quantityReserved, quantity);
    this._quantityReserved -= reservedToRelease;
    this.touch();
  }

  totalQuantity(): number {
    return this._quantityAvailable + this._quantityReserved;
  }

  canReserve(quantity: number): boolean {
    return quantity > 0 && this._quantityAvailable >= quantity;
  }

  private assertPositive(quantity: number): void {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive number');
    }
  }

  private touch(): void {
    this.updatedAt = new Date();
  }
}
