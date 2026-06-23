// =============================================================================
// CUSTOMER ENTITY — Aggregate Root của bounded context "Customer"
// =============================================================================
// Trong DDD, Entity là đối tượng có identity (id) duy nhất và vòng đời riêng.
// Customer là Aggregate Root — điểm truy cập duy nhất vào aggregate này.
// Mọi thay đổi trạng thái phải đi qua các method của entity,
// đảm bảo business rules luôn được tuân thủ (invariant protection).

/**
 * Định nghĩa các trạng thái hợp lệ của khách hàng.
 * - prospect:  Khách hàng tiềm năng, chưa giao dịch chính thức
 * - active:    Đang hoạt động, được phép đặt hàng
 * - suspended: Tạm ngưng, không được đặt hàng (vd: nợ quá hạn)
 * - archived:  Đã lưu trữ (soft delete), không hiển thị trong danh sách
 */
export type CustomerStatus = 'prospect' | 'active' | 'suspended' | 'archived';

/**
 * Interface mô tả cấu trúc dữ liệu để khởi tạo Customer entity.
 * Dùng khi reconstruct entity từ database hoặc tạo mới từ command.
 */
export interface CustomerProps {
  id: string;
  businessName: string;
  taxCode: string | null;
  status: CustomerStatus;
  creditLimitAmount: number | null;
  creditUsedAmount: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Customer Entity — Aggregate Root
 *
 * Chứa toàn bộ business logic liên quan đến khách hàng:
 * - Kiểm tra tín dụng trước khi cho phép đặt hàng
 * - Chuyển đổi trạng thái (activate, archive, suspend)
 * - Tính toán hạn mức tín dụng còn lại
 *
 * Domain layer KHÔNG import từ infrastructure — đảm bảo tính độc lập.
 * Entity chỉ phụ thuộc vào chính nó và các value object trong domain.
 */
export class Customer {
  // ---- Các thuộc tính private, chỉ thay đổi qua method ----

  /** ID duy nhất (UUID) — identity của entity */
  readonly id: string;

  /** Tên doanh nghiệp / tên khách hàng */
  businessName: string;

  /** Mã số thuế — có thể null nếu là khách hàng cá nhân */
  taxCode: string | null;

  /** Trạng thái hiện tại của khách hàng */
  status: CustomerStatus;

  /** Hạn mức tín dụng tối đa (VND) — null = không giới hạn hoặc chưa thiết lập */
  creditLimitAmount: number | null;

  /** Số tín dụng đã sử dụng — luôn >= 0 */
  creditUsedAmount: number;

  /** Tên người liên hệ */
  contactName: string | null;

  /** Số điện thoại liên hệ */
  contactPhone: string | null;

  /** Email liên hệ */
  contactEmail: string | null;

  /** Thời điểm tạo — set 1 lần khi INSERT */
  readonly createdAt: Date;

  /** Thời điểm cập nhật cuối cùng */
  updatedAt: Date;

  /** Thời điểm soft delete — null = chưa bị xóa */
  deletedAt: Date | null;

  /**
   * Constructor nhận đầy đủ props để reconstruct entity.
   * Private logic không nằm ở constructor mà nằm ở các method bên dưới.
   * Constructor chỉ gán giá trị — không validate (validate ở application layer).
   */
  constructor(props: CustomerProps) {
    this.id = props.id;
    this.businessName = props.businessName;
    this.taxCode = props.taxCode;
    this.status = props.status;
    this.creditLimitAmount = props.creditLimitAmount;
    this.creditUsedAmount = props.creditUsedAmount;
    this.contactName = props.contactName;
    this.contactPhone = props.contactPhone;
    this.contactEmail = props.contactEmail;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  // ==========================================================================
  // BUSINESS METHODS — Các phương thức chứa business logic cốt lõi
  // ==========================================================================

  /**
   * Kiểm tra khách hàng có đủ điều kiện đặt hàng với số tiền cho trước không.
   *
   * Điều kiện để đặt hàng thành công:
   * 1. Trạng thái phải là "active" — prospect/suspended/archived không được đặt
   * 2. Nếu có hạn mức tín dụng (creditLimitAmount != null):
   *    - Tín dụng khả dụng = creditLimitAmount - creditUsedAmount
   *    - Tín dụng khả dụng phải >= orderAmount
   * 3. Nếu không có hạn mức (null): luôn cho phép (trả trước hoặc unlimited)
   *
   * @param orderAmount - Số tiền đơn hàng cần kiểm tra (VND)
   * @returns true nếu đủ điều kiện, false nếu không
   */
  canPlaceOrder(orderAmount: number): boolean {
    // Chỉ khách hàng "active" mới được phép đặt hàng
    if (this.status !== 'active') {
      return false;
    }

    // Nếu không thiết lập hạn mức → cho phép đặt hàng (vd: trả tiền trước)
    if (this.creditLimitAmount === null) {
      return true;
    }

    // Tính tín dụng còn lại và so sánh với số tiền đơn hàng
    const availableCredit = this.creditLimitAmount - this.creditUsedAmount;
    return availableCredit >= orderAmount;
  }

  /**
   * Lưu trữ (archive) khách hàng — tương đương soft delete.
   * Set trạng thái thành "archived" và ghi lại thời điểm xóa.
   * Khách hàng archived sẽ không hiển thị trong danh sách tìm kiếm mặc định.
   */
  archive(): void {
    this.status = 'archived';
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Kích hoạt khách hàng — chuyển sang trạng thái "active".
   * Chỉ áp dụng khi khách hàng đang ở trạng thái khác (prospect, suspended).
   * Xóa deletedAt nếu trước đó đã bị archived.
   */
  activate(): void {
    this.status = 'active';
    this.deletedAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Update entity properties with partial changes.
   * Only updates fields that are explicitly provided (not undefined).
   * Encapsulates mutation within the entity — callers cannot mutate properties directly.
   *
   * @param changes - Partial set of updatable fields
   */
  update(
    changes: Partial<Omit<CustomerProps, 'id' | 'createdAt'>>,
  ): void {
    if (changes.businessName !== undefined) this.businessName = changes.businessName;
    if (changes.taxCode !== undefined) this.taxCode = changes.taxCode;
    if (changes.contactName !== undefined) this.contactName = changes.contactName;
    if (changes.contactPhone !== undefined) this.contactPhone = changes.contactPhone;
    if (changes.contactEmail !== undefined) this.contactEmail = changes.contactEmail;
    if (changes.creditLimitAmount !== undefined) this.creditLimitAmount = changes.creditLimitAmount;
    if (changes.creditUsedAmount !== undefined) this.creditUsedAmount = changes.creditUsedAmount;
    if (changes.status !== undefined) this.status = changes.status;
    if (changes.deletedAt !== undefined) this.deletedAt = changes.deletedAt;
    this.updatedAt = new Date();
  }

  /**
   * Tính số tín dụng còn khả dụng.
   *
   * Công thức: availableCredit = creditLimitAmount - creditUsedAmount
   * Nếu chưa thiết lập hạn mức → trả về 0 (không có credit line)
   *
   * @returns Số tín dụng khả dụng (VND), luôn >= 0
   */
  getAvailableCredit(): number {
    // Chưa thiết lập hạn mức → trả 0 thay vì null để dễ xử lý downstream
    if (this.creditLimitAmount === null) {
      return 0;
    }

    // Đảm bảo không trả về số âm (trường hợp creditUsed > creditLimit)
    const available = this.creditLimitAmount - this.creditUsedAmount;
    return Math.max(0, available);
  }
}
