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

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Customer } from '../../domain/entities/index.js';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import {
  validateUpdateCustomer,
  type UpdateCustomerDto,
} from '../dtos/index.js';
import { RedisCacheService } from '@erp/shared';

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
  async execute(dto: unknown): Promise<Customer> {
    // Validate dữ liệu đầu vào (ZodError → ZodExceptionFilter → 400)
    const validatedData = validateUpdateCustomer(dto);

    // Load entity hiện tại từ DB
    const existingCustomer = await this.customerRepository.findById(
      validatedData.id,
    );
    if (!existingCustomer) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID "${validatedData.id}"`,
      );
    }

    // Kiểm tra trùng lặp MST nếu đang thay đổi taxCode
    if (
      validatedData.taxCode &&
      validatedData.taxCode !== existingCustomer.taxCode
    ) {
      const duplicateCustomer = await this.customerRepository.findByTaxCode(
        validatedData.taxCode,
      );

      if (duplicateCustomer && duplicateCustomer.id !== existingCustomer.id) {
        throw new ConflictException(
          `Mã số thuế "${validatedData.taxCode}" đã được sử dụng bởi "${duplicateCustomer.businessName}"`,
        );
      }
    }

    // Apply changes through entity method (DDD encapsulation)
    const { id: _id, ...changes } = validatedData;
    existingCustomer.update(changes);

    // Save entity qua repository (update + outbox event trong transaction)
    const updatedCustomer =
      await this.customerRepository.save(existingCustomer);

    // Invalidate cache detail (search KHÔNG được cache → không cần invalidate).
    await this.cacheService.del(`customer:${validatedData.id}`);

    return updatedCustomer;
  }
}
