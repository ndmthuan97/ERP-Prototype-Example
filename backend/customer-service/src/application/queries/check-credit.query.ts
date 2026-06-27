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
 * Request parameters for credit check.
 * pendingOrdersTotal is provided by the caller (sales-service) to avoid
 * cross-bounded-context DB queries.
 */
export interface CreditCheckRequest {
  customerId: string;
  orderAmount: number;
  pendingOrdersTotal?: number;
}

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
  /** Amount tied up in pending (submitted but not confirmed) orders */
  pendingAmount: number;
  /** Tín dụng khả dụng còn lại (limit - used - pending) */
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
   * @param orderAmount - Amount of the new order being checked (default: 0)
   * @param pendingOrdersTotal - Sum of submitted-but-not-confirmed SOs (default: 0)
   * @returns CreditCheckResult chứa thông tin tín dụng chi tiết
   * @throws NotFoundException nếu khách hàng không tồn tại
   */
  async execute(
    customerId: string,
    orderAmount: number = 0,
    pendingOrdersTotal: number = 0,
  ): Promise<CreditCheckResult> {
    // Load entity từ DB
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID "${customerId}"`,
      );
    }

    // Available credit = limit - used - pending orders
    const rawAvailable = customer.getAvailableCredit();
    const available = Math.max(0, rawAvailable - pendingOrdersTotal);

    return {
      customerId: customer.id,
      creditLimit: customer.creditLimitAmount,
      creditUsed: customer.creditUsedAmount,
      pendingAmount: pendingOrdersTotal,
      available,
      canOrder: customer.canPlaceOrder(orderAmount + pendingOrdersTotal),
    };
  }
}
