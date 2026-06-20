// =============================================================================
// UNIT TEST — Customer Entity (Domain layer)
// =============================================================================
// Test business logic THUẦN của entity — không cần DB, không cần NestJS.
// Đây là điểm mạnh của Rich Domain Model: logic nằm trong entity → test cực dễ.

import { Customer, CustomerProps } from './customer.entity';

/**
 * Helper tạo Customer với giá trị mặc định hợp lý.
 * Cho phép override từng field để dựng đúng kịch bản cần test (test data builder).
 */
function makeCustomer(overrides: Partial<CustomerProps> = {}): Customer {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new Customer({
    id: 'cust-1',
    businessName: 'WeCare Corp',
    taxCode: null,
    status: 'active',
    creditLimitAmount: 10_000_000,
    creditUsedAmount: 0,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

describe('Customer entity', () => {
  describe('canPlaceOrder', () => {
    it('cho phép khi active và còn đủ hạn mức', () => {
      const customer = makeCustomer({
        creditLimitAmount: 10_000_000,
        creditUsedAmount: 2_000_000,
      });
      // Còn lại 8tr → đặt 5tr OK
      expect(customer.canPlaceOrder(5_000_000)).toBe(true);
    });

    it('từ chối khi vượt hạn mức tín dụng còn lại', () => {
      const customer = makeCustomer({
        creditLimitAmount: 10_000_000,
        creditUsedAmount: 8_000_000,
      });
      // Còn lại 2tr → đặt 5tr phải bị từ chối
      expect(customer.canPlaceOrder(5_000_000)).toBe(false);
    });

    it('từ chối khi trạng thái không phải active', () => {
      const suspended = makeCustomer({ status: 'suspended' });
      expect(suspended.canPlaceOrder(1)).toBe(false);
    });

    it('cho phép không giới hạn khi không thiết lập hạn mức (null)', () => {
      const customer = makeCustomer({ creditLimitAmount: null });
      expect(customer.canPlaceOrder(999_000_000)).toBe(true);
    });

    it('cho phép đúng bằng hạn mức còn lại (biên)', () => {
      const customer = makeCustomer({
        creditLimitAmount: 10_000_000,
        creditUsedAmount: 0,
      });
      expect(customer.canPlaceOrder(10_000_000)).toBe(true);
    });
  });

  describe('archive', () => {
    it('chuyển status = archived và set deletedAt', () => {
      const customer = makeCustomer();
      customer.archive();
      expect(customer.status).toBe('archived');
      expect(customer.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('activate', () => {
    it('chuyển về active và xoá deletedAt', () => {
      const customer = makeCustomer({
        status: 'archived',
        deletedAt: new Date(),
      });
      customer.activate();
      expect(customer.status).toBe('active');
      expect(customer.deletedAt).toBeNull();
    });
  });

  describe('getAvailableCredit', () => {
    it('trả về phần còn lại = limit - used', () => {
      const customer = makeCustomer({
        creditLimitAmount: 10_000_000,
        creditUsedAmount: 3_000_000,
      });
      expect(customer.getAvailableCredit()).toBe(7_000_000);
    });

    it('không bao giờ trả số âm (used > limit)', () => {
      const customer = makeCustomer({
        creditLimitAmount: 1_000_000,
        creditUsedAmount: 5_000_000,
      });
      expect(customer.getAvailableCredit()).toBe(0);
    });

    it('trả 0 khi chưa thiết lập hạn mức', () => {
      const customer = makeCustomer({ creditLimitAmount: null });
      expect(customer.getAvailableCredit()).toBe(0);
    });
  });
});
