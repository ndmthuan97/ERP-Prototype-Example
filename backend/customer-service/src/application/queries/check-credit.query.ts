// =============================================================================
// CHECK CREDIT QUERY — Use case kiểm tra tín dụng khách hàng
// =============================================================================
// Credit check là nghiệp vụ quan trọng trong ERP:
// - Order Service gọi API này trước khi tạo đơn hàng
// - Kiểm tra khách hàng có đủ hạn mức tín dụng không
// - Trả về thông tin chi tiết để Order Service quyết định cho phép/từ chối

import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/index.js';

/**
 * Kết quả kiểm tra tín dụng — plain object trả về cho consumer.
 * Không phải domain entity, chỉ là DTO cho response.
 */
export interface CreditCheckResult {
  /** ID khách hàng */
  customerId: string;
  /** Hạn mức tín dụng tối đa (null = chưa thiết lập) */
  creditLimit: number | null;
  /** Số tín dụng đã sử dụng */
  creditUsed: number;
  /** Tín dụng khả dụng còn lại */
  available: number;
  /** Khách hàng có thể đặt hàng không (status = active + có credit) */
  canOrder: boolean;
}

@Injectable()
export class CheckCreditQuery {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  /**
   * Kiểm tra tình trạng tín dụng của khách hàng.
   *
   * Order Service sẽ gọi endpoint này (GET /customers/:id/credit-check)
   * trước khi cho phép tạo đơn hàng mới.
   *
   * @param customerId - UUID khách hàng cần kiểm tra
   * @returns CreditCheckResult chứa thông tin tín dụng chi tiết
   * @throws NotFoundException nếu khách hàng không tồn tại
   */
  async execute(customerId: string): Promise<CreditCheckResult> {
    // Load entity từ DB
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID "${customerId}"`,
      );
    }

    // Dùng business method của entity để tính toán
    // Logic nằm trong entity, query chỉ orchestrate
    return {
      customerId: customer.id,
      creditLimit: customer.creditLimitAmount,
      creditUsed: customer.creditUsedAmount,
      available: customer.getAvailableCredit(),
      // canPlaceOrder(0) kiểm tra trạng thái active — amount=0 để chỉ check status
      canOrder: customer.canPlaceOrder(0),
    };
  }
}
