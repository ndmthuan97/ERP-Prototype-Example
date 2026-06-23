// =============================================================================
// STOCK ITEM ENTITY — Aggregate Root của bounded context "Inventory"
// =============================================================================
// Quản lý tồn kho 1 mặt hàng (SKU). Business rule cốt lõi: reserve/release/receive
// luôn giữ invariant: quantityAvailable >= 0, quantityReserved >= 0.
//
// `version` phục vụ Optimistic Locking ở tầng persistence (không tăng trong entity;
// repository so khớp + tăng version khi UPDATE).

/** Lỗi domain: không đủ tồn kho để giữ chỗ */
export class InsufficientStockError extends Error {
  constructor(sku: string, requested: number, available: number) {
    super(
      `Không đủ tồn kho cho SKU "${sku}": cần ${requested}, còn ${available}`,
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
  name: string;
  quantityAvailable: number;
  quantityReserved: number;
  /** Optimistic lock token — repository dùng để phát hiện ghi đè đồng thời */
  readonly version: number;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: StockItemProps) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.quantityAvailable = props.quantityAvailable;
    this.quantityReserved = props.quantityReserved;
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
    this.quantityAvailable += quantity;
    this.touch();
  }

  /**
   * Giữ chỗ (reserve) cho 1 đơn hàng: available → reserved.
   * @throws InsufficientStockError nếu không đủ khả dụng.
   */
  reserve(quantity: number): void {
    this.assertPositive(quantity);
    if (this.quantityAvailable < quantity) {
      throw new InsufficientStockError(
        this.sku,
        quantity,
        this.quantityAvailable,
      );
    }
    this.quantityAvailable -= quantity;
    this.quantityReserved += quantity;
    this.touch();
  }

  /**
   * Nhả giữ chỗ (release): reserved → available. Dùng khi đơn bị hủy.
   * Không nhả quá số đang giữ (kẹp về 0 để giữ invariant).
   */
  release(quantity: number): void {
    this.assertPositive(quantity);
    const releasable = Math.min(quantity, this.quantityReserved);
    this.quantityReserved -= releasable;
    this.quantityAvailable += releasable;
    this.touch();
  }

  /**
   * Issue stock — reduce available quantity (outbound shipment).
   * If reserved stock is being fulfilled, also reduce reserved accordingly.
   * @throws InsufficientStockError if not enough available stock
   */
  issue(quantity: number, reference?: string): void {
    this.assertPositive(quantity);
    if (this.quantityAvailable < quantity) {
      throw new InsufficientStockError(
        this.sku,
        quantity,
        this.quantityAvailable,
      );
    }
    this.quantityAvailable -= quantity;
    // If there's reserved stock being fulfilled, also reduce reserved
    const reservedToRelease = Math.min(this.quantityReserved, quantity);
    this.quantityReserved -= reservedToRelease;
    this.touch();
  }

  /** Tổng tồn (khả dụng + đang giữ) — phục vụ báo cáo. */
  totalQuantity(): number {
    return this.quantityAvailable + this.quantityReserved;
  }

  canReserve(quantity: number): boolean {
    return quantity > 0 && this.quantityAvailable >= quantity;
  }

  private assertPositive(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Số lượng phải là số nguyên dương');
    }
  }

  private touch(): void {
    this.updatedAt = new Date();
  }
}
