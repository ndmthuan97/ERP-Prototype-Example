// =============================================================================
// GET CUSTOMER QUERY — Use case lấy chi tiết 1 khách hàng
// =============================================================================
// Trong CQRS, Query chịu trách nhiệm cho các thao tác ĐỌC (read).
// Tách riêng Query khỏi Command giúp:
// - Tối ưu read path riêng (cache, read replica, projection)
// - Mỗi class chỉ làm 1 việc (SRP)
//
// Cache-Aside strategy:
// 1. Đọc cache trước (O(1) lookup)
// 2. Nếu cache miss → đọc DB → ghi vào cache → trả về
// 3. Nếu cache hit → trả về ngay, không cần DB query

import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import { Customer } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import { RedisCacheService } from '@erp/shared';

/** Prefix cho cache key — tổ chức key theo namespace */
const CACHE_KEY_PREFIX = 'customer';

@Injectable()
export class GetCustomerQuery {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Lấy chi tiết 1 khách hàng theo ID.
   *
   * Áp dụng Cache-Aside pattern:
   * 1. Kiểm tra cache trước — nếu có, reconstruct entity và trả về ngay
   * 2. Cache miss → query DB qua repository
   * 3. Tìm thấy → ghi cache cho lần sau → trả về
   * 4. Không tìm thấy → throw NotFoundException
   *
   * @param id - UUID của khách hàng
   * @returns Customer entity
   * @throws NotFoundException nếu không tìm thấy
   */
  async execute(id: string): Promise<Customer> {
    // Bước 1: Thử đọc từ cache — key format: "customer:{uuid}"
    const cacheKey = `${CACHE_KEY_PREFIX}:${id}`;
    const cachedData = await this.cacheService.get<Record<string, unknown>>(cacheKey);

    if (cachedData) {
      // Cache hit — reconstruct entity từ cached data
      // Cần convert lại Date vì JSON serialize sẽ chuyển Date → string
      return this.reconstructFromCache(cachedData);
    }

    // Bước 2: Cache miss — query database
    const customer = await this.customerRepository.findById(id);

    if (!customer) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID "${id}"`,
      );
    }

    // Bước 3: Ghi cache cho các request sau — TTL mặc định 5 phút
    await this.cacheService.set(cacheKey, this.serializeForCache(customer));

    return customer;
  }

  /**
   * Serialize Customer entity thành plain object để lưu cache.
   * Convert Date → ISO string vì JSON không hỗ trợ Date natively.
   */
  private serializeForCache(customer: Customer): Record<string, unknown> {
    return {
      id: customer.id,
      businessName: customer.businessName,
      taxCode: customer.taxCode,
      status: customer.status,
      creditLimitAmount: customer.creditLimitAmount,
      creditUsedAmount: customer.creditUsedAmount,
      contactName: customer.contactName,
      contactPhone: customer.contactPhone,
      contactEmail: customer.contactEmail,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      deletedAt: customer.deletedAt?.toISOString() ?? null,
    };
  }

  /**
   * Reconstruct Customer entity từ cached data.
   * Convert ISO string → Date object lại để entity hoạt động đúng.
   */
  private reconstructFromCache(data: Record<string, unknown>): Customer {
    return new Customer({
      id: data.id as string,
      businessName: data.businessName as string,
      taxCode: (data.taxCode as string) ?? null,
      status: data.status as Customer['status'],
      creditLimitAmount: (data.creditLimitAmount as number) ?? null,
      creditUsedAmount: (data.creditUsedAmount as number) ?? 0,
      contactName: (data.contactName as string) ?? null,
      contactPhone: (data.contactPhone as string) ?? null,
      contactEmail: (data.contactEmail as string) ?? null,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      deletedAt: data.deletedAt ? new Date(data.deletedAt as string) : null,
    });
  }
}
