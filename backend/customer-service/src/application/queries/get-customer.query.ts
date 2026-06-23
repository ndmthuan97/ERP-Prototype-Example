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

import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { z } from 'zod';

import { Customer, type CustomerStatus } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import { RedisCacheService } from '@erp/shared';

/** Prefix cho cache key — tổ chức key theo namespace */
const CACHE_KEY_PREFIX = 'customer';

/** Zod schema for validating cached customer data */
const CachedCustomerSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  taxCode: z.string().nullable(),
  status: z.string(),
  creditLimitAmount: z.number().nullable(),
  creditUsedAmount: z.number(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

@Injectable()
export class GetCustomerQuery {
  private readonly logger = new Logger(GetCustomerQuery.name);

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
    const cachedData =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);

    if (cachedData) {
      // Cache hit — validate + reconstruct entity from cached data
      const customer = this.reconstructFromCache(cachedData);
      if (customer) return customer;

      // Cache corrupted — invalidate and fall through to DB
      this.logger.warn(`Cache corrupted for key="${cacheKey}", invalidating`);
      await this.cacheService.del(cacheKey);
    }

    // Bước 2: Cache miss — query database
    const customer = await this.customerRepository.findById(id);

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID "${id}"`);
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
   * Reconstruct Customer entity from cached data with Zod validation.
   * Returns null if cache data is corrupted — caller falls back to DB.
   */
  private reconstructFromCache(data: unknown): Customer | null {
    const result = CachedCustomerSchema.safeParse(data);
    if (!result.success) {
      return null;
    }
    return new Customer({
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
      deletedAt: result.data.deletedAt ? new Date(result.data.deletedAt) : null,
      status: result.data.status as CustomerStatus,
    });
  }
}
