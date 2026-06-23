import { SKU } from './sku';

describe('SKU', () => {
  describe('create', () => {
    it('creates valid SKU', () => {
      const sku = SKU.create('ABC-123');
      expect(sku.value).toBe('ABC-123');
    });

    it('normalizes to uppercase', () => {
      const sku = SKU.create('abc-123');
      expect(sku.value).toBe('ABC-123');
    });

    it('trims whitespace', () => {
      const sku = SKU.create('  ABC-123  ');
      expect(sku.value).toBe('ABC-123');
    });

    it('accepts minimum length (3 chars)', () => {
      const sku = SKU.create('ABC');
      expect(sku.value).toBe('ABC');
    });

    it('rejects too short (2 chars)', () => {
      expect(() => SKU.create('AB')).toThrow('Invalid SKU');
    });

    it('rejects empty string', () => {
      expect(() => SKU.create('')).toThrow('Invalid SKU');
    });

    it('rejects starting with hyphen', () => {
      expect(() => SKU.create('-ABC')).toThrow('Invalid SKU');
    });

    it('rejects ending with hyphen', () => {
      expect(() => SKU.create('ABC-')).toThrow('Invalid SKU');
    });

    it('rejects special characters', () => {
      expect(() => SKU.create('ABC@123')).toThrow('Invalid SKU');
    });

    it('accepts hyphens in middle', () => {
      const sku = SKU.create('PROD-001-A');
      expect(sku.value).toBe('PROD-001-A');
    });
  });

  describe('equals', () => {
    it('returns true for same value', () => {
      const a = SKU.create('ABC-123');
      const b = SKU.create('abc-123');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different value', () => {
      const a = SKU.create('ABC-123');
      const b = SKU.create('XYZ-789');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the value', () => {
      expect(SKU.create('WIDGET-01').toString()).toBe('WIDGET-01');
    });
  });
});
