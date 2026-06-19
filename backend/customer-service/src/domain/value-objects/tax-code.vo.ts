// =============================================================================
// TAX CODE VALUE OBJECT — Đối tượng giá trị Mã Số Thuế
// =============================================================================
// Trong DDD, Value Object là đối tượng KHÔNG có identity riêng,
// chỉ được định nghĩa bởi giá trị (value) của nó.
// Hai TaxCode có cùng value → được coi là bằng nhau (equality by value).
//
// TaxCode encapsulate logic validate mã số thuế Việt Nam:
// - 10 chữ số (doanh nghiệp): VD: 0312345678
// - 10 chữ số + dash + 3 chữ số (chi nhánh): VD: 0312345678-001
// Bằng cách đặt validation ở Value Object, ta đảm bảo:
// - Không thể tạo TaxCode không hợp lệ (constructor ném lỗi)
// - Logic validate nằm 1 chỗ, không bị duplicate khắp nơi

/**
 * Value Object đại diện cho Mã Số Thuế (MST) Việt Nam.
 *
 * Immutable: sau khi tạo không thể thay đổi giá trị.
 * Self-validating: constructor tự validate, ném lỗi nếu không hợp lệ.
 */
export class TaxCode {
  /**
   * Giá trị mã số thuế — readonly để đảm bảo immutability.
   * Sau khi khởi tạo, không ai có thể thay đổi giá trị này.
   */
  readonly value: string;

  /**
   * Regex validate định dạng MST Việt Nam:
   * - ^\d{10}$        → 10 chữ số (doanh nghiệp chính)
   * - ^\d{10}-\d{3}$  → 10 chữ số + dấu gạch + 3 chữ số (chi nhánh / đơn vị phụ thuộc)
   *
   * Ví dụ hợp lệ: "0312345678", "0312345678-001"
   * Ví dụ không hợp lệ: "031234567" (9 số), "03123456789" (11 số), "abc"
   */
  private static readonly TAX_CODE_REGEX = /^\d{10}(-\d{3})?$/;

  /**
   * Constructor — tạo TaxCode mới, tự động validate.
   * Nếu mã số thuế không đúng định dạng → ném Error ngay lập tức.
   * Điều này đảm bảo KHÔNG BAO GIỜ tồn tại một instance TaxCode không hợp lệ.
   *
   * @param code - Chuỗi mã số thuế cần tạo
   * @throws Error nếu mã số thuế không đúng định dạng
   */
  constructor(code: string) {
    // Gọi static method để kiểm tra — tái sử dụng logic validate
    if (!TaxCode.isValid(code)) {
      throw new Error(
        `Mã số thuế không hợp lệ: "${code}". ` +
          `Định dạng đúng: 10 chữ số (VD: 0312345678) ` +
          `hoặc 10 chữ số + dấu gạch + 3 chữ số (VD: 0312345678-001)`,
      );
    }

    // Gán giá trị sau khi đã validate thành công
    this.value = code;
  }

  /**
   * Static method kiểm tra tính hợp lệ của mã số thuế.
   * Có thể gọi mà KHÔNG cần tạo instance: TaxCode.isValid("0312345678")
   * Hữu ích khi cần validate ở DTO layer trước khi tạo entity.
   *
   * @param code - Chuỗi cần kiểm tra
   * @returns true nếu đúng định dạng MST Việt Nam, false nếu không
   */
  static isValid(code: string): boolean {
    return TaxCode.TAX_CODE_REGEX.test(code);
  }

  /**
   * So sánh bằng theo giá trị (value equality) — đặc trưng của Value Object.
   * Hai TaxCode bằng nhau nếu và chỉ nếu chúng có cùng value.
   *
   * @param other - TaxCode khác cần so sánh
   * @returns true nếu cùng giá trị
   */
  equals(other: TaxCode): boolean {
    return this.value === other.value;
  }

  /**
   * Trả về chuỗi string khi cần serialize hoặc hiển thị.
   */
  toString(): string {
    return this.value;
  }
}
