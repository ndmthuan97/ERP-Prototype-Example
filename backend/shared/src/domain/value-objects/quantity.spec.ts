import { Quantity } from './quantity';

describe('Quantity', () => {
  describe('create', () => {
    it('creates with valid integer', () => {
      const q = Quantity.create(5);
      expect(q.value).toBe(5);
    });

    it('allows zero', () => {
      const q = Quantity.create(0);
      expect(q.isZero()).toBe(true);
    });

    it('rejects negative', () => {
      expect(() => Quantity.create(-1)).toThrow('non-negative integer');
    });

    it('rejects float', () => {
      expect(() => Quantity.create(1.5)).toThrow('non-negative integer');
    });

    it('rejects NaN', () => {
      expect(() => Quantity.create(NaN)).toThrow('non-negative integer');
    });
  });

  describe('arithmetic', () => {
    it('adds', () => {
      const a = Quantity.create(3);
      const b = Quantity.create(2);
      expect(a.add(b).value).toBe(5);
    });

    it('subtracts', () => {
      const a = Quantity.create(5);
      const b = Quantity.create(3);
      expect(a.subtract(b).value).toBe(2);
    });

    it('subtract throws if result would be negative', () => {
      const a = Quantity.create(2);
      const b = Quantity.create(5);
      expect(() => a.subtract(b)).toThrow('negative');
    });
  });

  describe('comparison', () => {
    it('isGreaterThan', () => {
      expect(Quantity.create(5).isGreaterThan(Quantity.create(3))).toBe(true);
      expect(Quantity.create(3).isGreaterThan(Quantity.create(5))).toBe(false);
    });

    it('isGreaterThanOrEqual', () => {
      expect(Quantity.create(5).isGreaterThanOrEqual(Quantity.create(5))).toBe(true);
      expect(Quantity.create(4).isGreaterThanOrEqual(Quantity.create(5))).toBe(false);
    });

    it('equals', () => {
      expect(Quantity.create(3).equals(Quantity.create(3))).toBe(true);
      expect(Quantity.create(3).equals(Quantity.create(4))).toBe(false);
    });
  });

  describe('immutability', () => {
    it('add returns new instance', () => {
      const a = Quantity.create(3);
      const result = a.add(Quantity.create(2));
      expect(result).not.toBe(a);
      expect(a.value).toBe(3);
    });
  });
});
