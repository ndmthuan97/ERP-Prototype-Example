// =============================================================================
// UPDATE CUSTOMER COMMAND — Use case cập nhật thông tin khách hàng
// =============================================================================
// Partial update: chỉ cập nhật các field được gửi, giữ nguyên field không đổi.
//
// Flow:
// 1. Validate DTO đầu vào
// 2. Load entity hiện tại từ DB
// 3. Apply các thay đổi lên entity
// 4. Save entity mới qua repository
// 5. Invalidate cache cũ

import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';

import { Customer } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import { validateUpdateCustomer, type UpdateCustomerDto } from '../dtos/index.js';
import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service.js';

@Injectable()
export class UpdateCustomerCommand {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Thực thi use case cập nhật khách hàng.
   *
   * @param dto - Dữ liệu cập nhật (id bắt buộc, các field khác optional)
   * @returns Customer entity sau khi cập nhật
   * @throws NotFoundException nếu khách hàng không tồn tại
   * @throws ConflictException nếu mã số thuế mới đã được sử dụng
   */
  async execute(dto: UpdateCustomerDto): Promise<Customer> {
    // Validate dữ liệu đầu vào
    const validatedData = validateUpdateCustomer(dto);

    // Load entity hiện tại từ DB
    const existingCustomer = await this.customerRepository.findById(validatedData.id);
    if (!existingCustomer) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID "${validatedData.id}"`,
      );
    }

    // Kiểm tra trùng lặp MST nếu đang thay đổi taxCode
    if (validatedData.taxCode && validatedData.taxCode !== existingCustomer.taxCode) {
      const duplicateCustomer = await this.customerRepository.findByTaxCode(
        validatedData.taxCode,
      );

      if (duplicateCustomer && duplicateCustomer.id !== existingCustomer.id) {
        throw new ConflictException(
          `Mã số thuế "${validatedData.taxCode}" đã được sử dụng bởi "${duplicateCustomer.businessName}"`,
        );
      }
    }

    // Apply các thay đổi lên entity
    // Chỉ cập nhật field có giá trị trong DTO (undefined = giữ nguyên)
    this.applyChanges(existingCustomer, validatedData);

    // Save entity qua repository (update + outbox event trong transaction)
    const updatedCustomer = await this.customerRepository.save(existingCustomer);

    // Invalidate cache: cả cache detail lẫn search cache
    await Promise.all([
      this.cacheService.del(`customer:${validatedData.id}`),
      this.cacheService.invalidatePattern('customers:search:*'),
    ]);

    return updatedCustomer;
  }

  /**
   * Apply partial changes lên entity hiện tại.
   * Chỉ cập nhật field có giá trị (không phải undefined) trong DTO.
   * Tách method riêng để giữ execute() ngắn gọn (SRP).
   *
   * @param customer - Entity hiện tại (sẽ bị mutate)
   * @param changes  - Các field cần thay đổi
   */
  private applyChanges(
    customer: Customer,
    changes: Omit<UpdateCustomerDto, 'id'>,
  ): void {
    if (changes.businessName !== undefined) {
      customer.businessName = changes.businessName;
    }
    if (changes.taxCode !== undefined) {
      customer.taxCode = changes.taxCode;
    }
    if (changes.contactName !== undefined) {
      customer.contactName = changes.contactName;
    }
    if (changes.contactPhone !== undefined) {
      customer.contactPhone = changes.contactPhone;
    }
    if (changes.contactEmail !== undefined) {
      customer.contactEmail = changes.contactEmail;
    }
    if (changes.creditLimitAmount !== undefined) {
      customer.creditLimitAmount = changes.creditLimitAmount;
    }

    // Cập nhật timestamp khi có bất kỳ thay đổi nào
    customer.updatedAt = new Date();
  }
}
