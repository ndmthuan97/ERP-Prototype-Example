// =============================================================================
// UNIT TEST — StockItem.issue() (Domain)
// =============================================================================
import {
  StockItem,
  StockItemProps,
  InsufficientStockError,
} from '../../src/domain/entities/stock-item.entity';

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

describe('StockItem.issue()', () => {
  it('should reduce quantityAvailable by the issued amount', () => {
    const item = makeItem({ quantityAvailable: 50 });
    item.issue(20);
    expect(item.quantityAvailable).toBe(30);
  });

  it('should allow issuing exactly all available stock', () => {
    const item = makeItem({ quantityAvailable: 10 });
    item.issue(10);
    expect(item.quantityAvailable).toBe(0);
  });

  it('should throw InsufficientStockError when issuing more than available', () => {
    const item = makeItem({ quantityAvailable: 5 });
    expect(() => item.issue(10)).toThrow(InsufficientStockError);
    // State should remain unchanged after failed issue
    expect(item.quantityAvailable).toBe(5);
  });

  it('should throw Error when quantity is zero', () => {
    const item = makeItem({ quantityAvailable: 50 });
    expect(() => item.issue(0)).toThrow();
    expect(item.quantityAvailable).toBe(50);
  });

  it('should throw Error when quantity is negative', () => {
    const item = makeItem({ quantityAvailable: 50 });
    expect(() => item.issue(-5)).toThrow();
    expect(item.quantityAvailable).toBe(50);
  });

  it('should reduce reserved stock when there is reserved quantity', () => {
    const item = makeItem({ quantityAvailable: 100, quantityReserved: 30 });
    item.issue(20);
    // available reduced by 20
    expect(item.quantityAvailable).toBe(80);
    // reserved reduced by min(30, 20) = 20
    expect(item.quantityReserved).toBe(10);
  });

  it('should reduce reserved stock to 0 when issuing more than reserved', () => {
    const item = makeItem({ quantityAvailable: 100, quantityReserved: 10 });
    item.issue(50);
    expect(item.quantityAvailable).toBe(50);
    // reserved reduced by min(10, 50) = 10 → 0
    expect(item.quantityReserved).toBe(0);
  });

  it('should update the updatedAt timestamp', () => {
    const originalDate = new Date('2026-01-01T00:00:00.000Z');
    const item = makeItem({ updatedAt: originalDate });
    item.issue(10);
    expect(item.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
  });
});
