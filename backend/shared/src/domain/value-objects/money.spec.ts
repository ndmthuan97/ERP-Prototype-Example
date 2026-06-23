import { Money, CurrencyMismatchError } from './money';

describe('Money', () => {
  describe('create', () => {
    it('creates with default VND currency', () => {
      const m = Money.create(100);
      expect(m.amount).toBe(100);
      expect(m.currency).toBe('VND');
    });

    it('normalizes currency to uppercase', () => {
      const m = Money.create(50, 'usd');
      expect(m.currency).toBe('USD');
    });

    it('allows zero amount', () => {
      const m = Money.create(0);
      expect(m.isZero()).toBe(true);
    });

    it('allows negative amount', () => {
      const m = Money.create(-100);
      expect(m.isNegative()).toBe(true);
    });

    it('rejects NaN', () => {
      expect(() => Money.create(NaN)).toThrow('finite number');
    });

    it('rejects Infinity', () => {
      expect(() => Money.create(Infinity)).toThrow('finite number');
    });
  });

  describe('zero', () => {
    it('creates zero amount', () => {
      const m = Money.zero();
      expect(m.amount).toBe(0);
      expect(m.currency).toBe('VND');
    });
  });

  describe('arithmetic', () => {
    it('adds same currency', () => {
      const a = Money.create(100);
      const b = Money.create(50);
      expect(a.add(b).amount).toBe(150);
    });

    it('subtracts same currency', () => {
      const a = Money.create(100);
      const b = Money.create(30);
      expect(a.subtract(b).amount).toBe(70);
    });

    it('multiplies by factor', () => {
      const m = Money.create(100);
      expect(m.multiply(3).amount).toBe(300);
    });

    it('rejects add with different currency', () => {
      const vnd = Money.create(100, 'VND');
      const usd = Money.create(50, 'USD');
      expect(() => vnd.add(usd)).toThrow(CurrencyMismatchError);
    });

    it('rejects subtract with different currency', () => {
      const vnd = Money.create(100, 'VND');
      const usd = Money.create(50, 'USD');
      expect(() => vnd.subtract(usd)).toThrow(CurrencyMismatchError);
    });

    it('multiply rejects non-finite factor', () => {
      const m = Money.create(100);
      expect(() => m.multiply(NaN)).toThrow('finite number');
    });
  });

  describe('comparison', () => {
    it('isGreaterThanOrEqual with same currency', () => {
      const a = Money.create(100);
      const b = Money.create(50);
      expect(a.isGreaterThanOrEqual(b)).toBe(true);
      expect(b.isGreaterThanOrEqual(a)).toBe(false);
      expect(a.isGreaterThanOrEqual(Money.create(100))).toBe(true);
    });

    it('equals checks both amount and currency', () => {
      const a = Money.create(100, 'VND');
      const b = Money.create(100, 'VND');
      const c = Money.create(100, 'USD');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('add returns new instance', () => {
      const a = Money.create(100);
      const b = Money.create(50);
      const result = a.add(b);
      expect(result).not.toBe(a);
      expect(a.amount).toBe(100); // original unchanged
    });
  });

  describe('toString', () => {
    it('formats as "amount currency"', () => {
      expect(Money.create(1000, 'VND').toString()).toBe('1000 VND');
    });
  });
});
