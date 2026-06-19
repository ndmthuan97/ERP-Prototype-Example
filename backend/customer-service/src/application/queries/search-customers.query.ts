// =============================================================================
// SEARCH CUSTOMERS QUERY — Use case tìm kiếm khách hàng với phân trang
// =============================================================================
// Hỗ trợ tìm kiếm theo tên doanh nghiệp (ILIKE) với phân trang.
// Trả về kết quả dạng paginated: { data, total, page, limit }
//
// Không cache search results vì:
// - Query combinations quá nhiều (query * page * limit)
// - Dữ liệu thay đổi thường xuyên
// - Cost cache invalidation > cost re-query

import { Injectable, Inject } from '@nestjs/common';

import { Customer } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
  type PaginatedResult,
} from '../../domain/repositories/index.js';

/** Số bản ghi mặc định mỗi trang */
const DEFAULT_PAGE_SIZE = 20;

/** Số bản ghi tối đa mỗi trang — tránh client request quá nhiều data */
const MAX_PAGE_SIZE = 100;

@Injectable()
export class SearchCustomersQuery {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  /**
   * Tìm kiếm khách hàng theo từ khóa với phân trang.
   *
   * @param query - Từ khóa tìm kiếm (tên doanh nghiệp), rỗng = lấy tất cả
   * @param page  - Trang cần lấy (1-indexed), mặc định 1
   * @param limit - Số bản ghi mỗi trang, mặc định 20, tối đa 100
   * @returns Kết quả phân trang gồm data, total, page, limit
   */
  async execute(
    query: string = '',
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedResult<Customer>> {
    // Normalize input: đảm bảo page >= 1 và limit trong khoảng hợp lệ
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

    // Delegate xuống repository — repository biết cách query database
    return this.customerRepository.search(
      query.trim(),
      normalizedPage,
      normalizedLimit,
    );
  }
}
