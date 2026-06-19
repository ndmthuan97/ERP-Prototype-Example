// =============================================================================
// CUSTOMER REPOSITORY INTERFACE — Port trong kiến trúc Hexagonal / DDD
// =============================================================================
// Trong DDD, Repository Interface nằm ở DOMAIN layer (không phải infrastructure).
// Đây là "port" — định nghĩa CONTRACT mà infrastructure layer phải implement.
//
// Tại sao interface nằm ở domain?
// → Domain layer không biết dữ liệu được lưu ở đâu (PostgreSQL, MongoDB, in-memory).
// → Domain chỉ khai báo "tôi CẦN GÌ", infrastructure sẽ cung cấp "implementation".
// → Đảm bảo Dependency Inversion Principle (DIP) — domain không phụ thuộc infra.
//
// Token CUSTOMER_REPOSITORY dùng cho NestJS DI container.
// Khi inject, ta dùng @Inject(CUSTOMER_REPOSITORY) thay vì inject class cụ thể.

import { Customer } from '../entities/index.js';

/**
 * Token constant dùng cho NestJS Dependency Injection.
 * Khi register provider: { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository }
 * Khi inject: @Inject(CUSTOMER_REPOSITORY) private repo: ICustomerRepository
 */
export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';

/**
 * Interface kết quả tìm kiếm phân trang.
 * Bao gồm danh sách dữ liệu và metadata phân trang.
 */
export interface PaginatedResult<T> {
  /** Danh sách kết quả trong trang hiện tại */
  data: T[];
  /** Tổng số bản ghi khớp điều kiện tìm kiếm */
  total: number;
  /** Trang hiện tại (1-indexed) */
  page: number;
  /** Số bản ghi mỗi trang */
  limit: number;
}

/**
 * ICustomerRepository — Interface định nghĩa các thao tác persistence cho Customer.
 *
 * Các method này chỉ mô tả "what" (cần làm gì), không mô tả "how" (làm thế nào).
 * Implementation cụ thể (PrismaCustomerRepository) sẽ quyết định cách thực hiện.
 */
export interface ICustomerRepository {
  /**
   * Tìm khách hàng theo ID.
   * Chỉ trả về khách hàng chưa bị soft delete (deletedAt IS NULL).
   *
   * @param id - UUID của khách hàng
   * @returns Customer entity hoặc null nếu không tìm thấy
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * Tìm khách hàng theo mã số thuế.
   * Dùng để kiểm tra trùng lặp khi tạo mới.
   *
   * @param taxCode - Mã số thuế cần tìm
   * @returns Customer entity hoặc null nếu không tìm thấy
   */
  findByTaxCode(taxCode: string): Promise<Customer | null>;

  /**
   * Tìm kiếm khách hàng theo từ khóa với phân trang.
   * Từ khóa sẽ được tìm trong businessName (ILIKE / contains).
   *
   * @param query - Từ khóa tìm kiếm (tên doanh nghiệp)
   * @param page  - Trang cần lấy (1-indexed)
   * @param limit - Số bản ghi mỗi trang
   * @returns Kết quả phân trang gồm data, total, page, limit
   */
  search(query: string, page: number, limit: number): Promise<PaginatedResult<Customer>>;

  /**
   * Lưu (tạo mới hoặc cập nhật) khách hàng.
   * Dùng upsert pattern: nếu ID đã tồn tại → update, chưa có → create.
   * Phải ghi outbox event trong cùng transaction.
   *
   * @param customer - Customer entity cần lưu
   * @returns Customer entity sau khi lưu (có thể có updatedAt mới)
   */
  save(customer: Customer): Promise<Customer>;

  /**
   * Soft delete khách hàng — đánh dấu deletedAt thay vì xóa vật lý.
   * Phải ghi outbox event "customer.deleted" trong cùng transaction.
   *
   * @param customer - Customer entity cần xóa mềm
   * @returns void
   */
  delete(customer: Customer): Promise<void>;
}
