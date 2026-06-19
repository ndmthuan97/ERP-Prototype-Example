// =============================================================================
// UNIT TEST — TaxCode Value Object (Domain layer)
// =============================================================================
// Value Object self-validating: KHÔNG thể tồn tại 1 TaxCode không hợp lệ.
// Test cả static isValid() lẫn hành vi constructor (throw) và equals().

import { TaxCode } from './tax-code.vo';

describe('TaxCode value object', () => {
  describe('isValid', () => {
    it('chấp nhận 10 chữ số (doanh nghiệp)', () => {
      expect(TaxCode.isValid('0312345678')).toBe(true);
    });

    it('chấp nhận 10 chữ số + dash + 3 chữ số (chi nhánh)', () => {
      expect(TaxCode.isValid('0312345678-001')).toBe(true);
    });

    it('từ chối khi sai số chữ số', () => {
      expect(TaxCode.isValid('031234567')).toBe(false); // 9 số
      expect(TaxCode.isValid('03123456789')).toBe(false); // 11 số
    });

    it('từ chối khi có ký tự không phải số', () => {
      expect(TaxCode.isValid('abc1234567')).toBe(false);
      expect(TaxCode.isValid('')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('tạo được khi hợp lệ và giữ nguyên value', () => {
      const taxCode = new TaxCode('0312345678');
      expect(taxCode.value).toBe('0312345678');
      expect(taxCode.toString()).toBe('0312345678');
    });

    it('throw khi không hợp lệ (không bao giờ có instance sai)', () => {
      expect(() => new TaxCode('invalid')).toThrow();
    });
  });

  describe('equals', () => {
    it('hai TaxCode cùng value thì bằng nhau (value equality)', () => {
      expect(new TaxCode('0312345678').equals(new TaxCode('0312345678'))).toBe(true);
    });

    it('khác value thì không bằng', () => {
      expect(new TaxCode('0312345678').equals(new TaxCode('0312345678-001'))).toBe(false);
    });
  });
});
