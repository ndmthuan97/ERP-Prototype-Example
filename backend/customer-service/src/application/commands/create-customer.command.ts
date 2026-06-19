// =============================================================================
// CREATE CUSTOMER COMMAND — Use case tạo mới khách hàng
// =============================================================================
// Trong CQRS pattern, Command chịu trách nhiệm cho các thao tác GHI (write).
// Mỗi command = 1 use case cụ thể (Single Responsibility Principle).
//
// CreateCustomerCommand thực hiện:
// 1. Validate dữ liệu đầu vào (Zod schema)
// 2. Kiểm tra trùng lặp mã số thuế (business rule)
// 3. Tạo Customer entity mới
// 4. Lưu vào database qua repository (+ outbox event)
// 5. Invalidate cache liên quan
// 6. Trả về customer đã tạo

import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { Customer } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import { validateCreateCustomer, type CreateCustomerDto } from '../dtos/index.js';
import { RedisCacheService } from '@erp/shared';

@Injectable()
export class CreateCustomerCommand {
  /**
   * Inject dependencies qua constructor (Dependency Injection).
   *
   * @Inject(CUSTOMER_REPOSITORY) — inject bằng token thay vì class cụ thể.
   * Nhờ vậy, khi thay đổi implementation (vd: từ Prisma sang MongoDB),
   * chỉ cần đổi provider registration, không sửa code ở đây.
   */
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Thực thi use case tạo mới khách hàng.
   *
   * Flow:
   * 1. Validate DTO bằng Zod → throw ZodError nếu sai
   * 2. Nếu có taxCode → kiểm tra trùng lặp trong DB
   * 3. Tạo Customer entity với UUID mới
   * 4. Gọi repository.save() → upsert + outbox event (trong transaction)
   * 5. Invalidate cache danh sách (search cache)
   * 6. Return customer đã tạo
   *
   * @param dto - Dữ liệu từ controller (đã parse sơ bộ từ request body)
   * @returns Customer entity đã được lưu thành công
   * @throws ConflictException nếu mã số thuế đã tồn tại
   */
  async execute(dto: CreateCustomerDto): Promise<Customer> {
    // Bước 1: Validate dữ liệu — Zod throw error nếu không hợp lệ
    const validatedData = validateCreateCustomer(dto);

    // Bước 2: Kiểm tra trùng lặp mã số thuế (nếu có)
    // Business rule: mỗi doanh nghiệp chỉ có 1 MST duy nhất
    if (validatedData.taxCode) {
      const existingCustomer = await this.customerRepository.findByTaxCode(
        validatedData.taxCode,
      );

      if (existingCustomer) {
        throw new ConflictException(
          `Mã số thuế "${validatedData.taxCode}" đã được sử dụng bởi "${existingCustomer.businessName}"`,
        );
      }
    }

    // Bước 3: Tạo Customer entity mới
    // UUID sinh ở application layer (không phụ thuộc DB auto-generate)
    // Giúp entity có id ngay trước khi persist — hữu ích cho event sourcing
    const now = new Date();
    const customer = new Customer({
      id: uuidv4(),
      businessName: validatedData.businessName,
      taxCode: validatedData.taxCode ?? null,
      status: 'active',
      creditLimitAmount: validatedData.creditLimitAmount ?? null,
      creditUsedAmount: 0,
      contactName: validatedData.contactName ?? null,
      contactPhone: validatedData.contactPhone ?? null,
      contactEmail: validatedData.contactEmail ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    // Bước 4: Lưu vào DB qua repository (upsert + outbox trong transaction)
    const savedCustomer = await this.customerRepository.save(customer);

    // Bước 5: Invalidate cache danh sách (search results có thể thay đổi)
    await this.cacheService.invalidatePattern('customers:search:*');

    return savedCustomer;
  }
}
