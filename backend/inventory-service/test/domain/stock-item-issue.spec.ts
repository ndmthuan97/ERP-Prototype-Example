// =============================================================================
// UNIT TEST — StockItem.issue() (Domain)
// =============================================================================
import {
  StockItem,
  StockItemProps,
  InsufficientStockError,
  InsufficientReservedError,
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

  it('should NOT touch reserved stock (issue draws down available only)', () => {
    const item = makeItem({ quantityAvailable: 100, quantityReserved: 30 });
    item.issue(20);
    // available reduced by 20
    expect(item.quantityAvailable).toBe(80);
    // reserved is a separate pool — a direct issue must not raid it
    expect(item.quantityReserved).toBe(30);
  });

  it('should update the updatedAt timestamp', () => {
    const originalDate = new Date('2026-01-01T00:00:00.000Z');
    const item = makeItem({ updatedAt: originalDate });
    item.issue(10);
    expect(item.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
  });
});

describe('StockItem.issueReserved()', () => {
  it('should draw down reserved only, leaving available unchanged', () => {
    const item = makeItem({ quantityAvailable: 80, quantityReserved: 20 });
    item.issueReserved(20);
    // available already lost the qty at reserve() time — do not touch it again
    expect(item.quantityAvailable).toBe(80);
    expect(item.quantityReserved).toBe(0);
    // net on-hand dropped by exactly 20 (no double count)
    expect(item.totalQuantity()).toBe(80);
  });

  it('reserve() then issueReserved() nets a single decrement of on-hand', () => {
    const item = makeItem({ quantityAvailable: 100, quantityReserved: 0 });
    const before = item.totalQuantity(); // 100
    item.reserve(20); // available 80, reserved 20, total 100
    item.issueReserved(20); // available 80, reserved 0, total 80
    expect(item.quantityAvailable).toBe(80);
    expect(item.quantityReserved).toBe(0);
    expect(item.totalQuantity()).toBe(before - 20);
  });

  it('should throw InsufficientReservedError when issuing more than reserved', () => {
    const item = makeItem({ quantityAvailable: 100, quantityReserved: 10 });
    expect(() => item.issueReserved(50)).toThrow(InsufficientReservedError);
    expect(item.quantityReserved).toBe(10);
    expect(item.quantityAvailable).toBe(100);
  });
});
