// =============================================================================
// UNIT TEST — StockItem entity (Domain)
// =============================================================================
import {
  StockItem,
  StockItemProps,
  InsufficientStockError,
} from './stock-item.entity';

function makeItem(overrides: Partial<StockItemProps> = {}): StockItem {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new StockItem({
    id: 'item-1',
    sku: 'SKU-001',
    name: 'Widget',
    quantityAvailable: 100,
    quantityReserved: 0,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('StockItem entity', () => {
  describe('receive', () => {
    it('tăng quantityAvailable', () => {
      const item = makeItem({ quantityAvailable: 10 });
      item.receive(5);
      expect(item.quantityAvailable).toBe(15);
    });

    it('should accept decimal quantity', () => {
      const item = makeItem({ quantityAvailable: 10 });
      item.receive(2.5);
      expect(item.quantityAvailable).toBe(12.5);
    });

    it('từ chối số lượng không dương', () => {
      const item = makeItem();
      expect(() => item.receive(0)).toThrow();
      expect(() => item.receive(-3)).toThrow();
    });

    it('should reject non-finite quantity', () => {
      const item = makeItem();
      expect(() => item.receive(NaN)).toThrow();
      expect(() => item.receive(Infinity)).toThrow();
    });
  });

  describe('reserve', () => {
    it('chuyển available → reserved khi đủ', () => {
      const item = makeItem({ quantityAvailable: 100, quantityReserved: 0 });
      item.reserve(30);
      expect(item.quantityAvailable).toBe(70);
      expect(item.quantityReserved).toBe(30);
    });

    it('should accept decimal reserve quantity', () => {
      const item = makeItem({ quantityAvailable: 100, quantityReserved: 0 });
      item.reserve(2.5);
      expect(item.quantityAvailable).toBe(97.5);
      expect(item.quantityReserved).toBe(2.5);
    });

    it('ném InsufficientStockError khi thiếu', () => {
      const item = makeItem({ quantityAvailable: 5 });
      expect(() => item.reserve(10)).toThrow(InsufficientStockError);
      // state không đổi
      expect(item.quantityAvailable).toBe(5);
      expect(item.quantityReserved).toBe(0);
    });

    it('cho phép reserve đúng bằng available (biên)', () => {
      const item = makeItem({ quantityAvailable: 10 });
      item.reserve(10);
      expect(item.quantityAvailable).toBe(0);
      expect(item.quantityReserved).toBe(10);
    });
  });

  describe('release', () => {
    it('chuyển reserved → available', () => {
      const item = makeItem({ quantityAvailable: 70, quantityReserved: 30 });
      item.release(20);
      expect(item.quantityReserved).toBe(10);
      expect(item.quantityAvailable).toBe(90);
    });

    it('không nhả quá số đang giữ (kẹp về 0)', () => {
      const item = makeItem({ quantityAvailable: 90, quantityReserved: 10 });
      item.release(999);
      expect(item.quantityReserved).toBe(0);
      expect(item.quantityAvailable).toBe(100);
    });
  });

  describe('canReserve / totalQuantity', () => {
    it('canReserve đúng theo available', () => {
      const item = makeItem({ quantityAvailable: 5 });
      expect(item.canReserve(5)).toBe(true);
      expect(item.canReserve(6)).toBe(false);
      expect(item.canReserve(0)).toBe(false);
    });

    it('totalQuantity = available + reserved', () => {
      const item = makeItem({ quantityAvailable: 70, quantityReserved: 30 });
      expect(item.totalQuantity()).toBe(100);
    });
  });
});
