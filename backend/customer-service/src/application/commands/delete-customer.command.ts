// =============================================================================
// DELETE CUSTOMER COMMAND — Use case soft-delete khách hàng
// =============================================================================
// Soft delete thay vì hard delete:
// - Không xóa vật lý bản ghi trong DB
// - Chuyển trạng thái sang "archived" và set deletedAt = now()
// - Dữ liệu vẫn còn để audit, restore, hoặc báo cáo lịch sử
//
// Flow:
// 1. Load entity từ DB
// 2. Gọi entity.archive() — business logic nằm trong entity
// 3. Ghi thay đổi + outbox event qua repository.delete()
// 4. Invalidate cache

import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';
import { RedisCacheService } from '@erp/shared';

@Injectable()
export class DeleteCustomerCommand {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Thực thi use case soft-delete khách hàng.
   *
   * @param id - UUID của khách hàng cần xóa
   * @throws NotFoundException nếu khách hàng không tồn tại hoặc đã bị archived
   */
  async execute(id: string): Promise<void> {
    // Load entity hiện tại — findById đã filter deletedAt IS NULL
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID "${id}"`);
    }

    // Gọi business method archive() trên entity
    // Entity tự quản lý logic chuyển trạng thái (DDD pattern)
    customer.archive();

    // Persist thay đổi + ghi outbox event trong transaction
    await this.customerRepository.delete(customer);

    // Invalidate cache detail (search KHÔNG được cache → không cần invalidate).
    await this.cacheService.del(`customer:${id}`);
  }
}
