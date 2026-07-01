import { SalesOrderLine } from './sales-order-line.entity';

describe('SalesOrderLine', () => {
  describe('create', () => {
    it('should calculate lineTotal = (quantity × unitPrice) + taxAmount when taxRate=0', () => {
      const line = SalesOrderLine.create(
        'l1',
        'item-1',
        'Bàn gỗ',
        10,
        1500000,
        0,
      );

      expect(line.quantity).toBe(10);
      expect(line.unitPrice).toBe(1500000);
      expect(line.taxRate).toBe(0);
      expect(line.taxAmount).toBe(0);
      expect(line.lineTotal).toBe(15000000);
    });

    it('should calculate tax at 10% rate', () => {
      const line = SalesOrderLine.create(
        'l1',
        'item-1',
        'Widget',
        2,
        1000,
        0.1,
      );

      expect(line.taxRate).toBe(0.1);
      expect(line.taxAmount).toBe(200); // 2 × 1000 × 0.10
      expect(line.lineTotal).toBe(2200); // 2000 + 200
    });

    it('should store itemName snapshot', () => {
      const line = SalesOrderLine.create(
        'l1',
        'item-1',
        'Tên sản phẩm',
        1,
        100,
      );
      expect(line.itemName).toBe('Tên sản phẩm');
    });

    it('should allow unitPrice = 0 (free/promotional item)', () => {
      const line = SalesOrderLine.create('l1', 'item-1', 'Free Gift', 3, 0);
      expect(line.unitPrice).toBe(0);
      expect(line.taxAmount).toBe(0);
      expect(line.lineTotal).toBe(0);
    });

    it('should allow decimal quantity (kg, liters, meters)', () => {
      const line = SalesOrderLine.create(
        'l1',
        'item-1',
        'Fabric',
        1.5,
        100,
        0.1,
      );
      expect(line.quantity).toBe(1.5);
      expect(line.taxAmount).toBe(15); // 1.5 × 100 × 0.10
      expect(line.lineTotal).toBe(165); // 150 + 15
    });

    it('should default taxRate to 0 when not provided', () => {
      const line = SalesOrderLine.create('l1', 'item-1', 'Test', 1, 100);
      expect(line.taxRate).toBe(0);
      expect(line.taxAmount).toBe(0);
      expect(line.lineTotal).toBe(100);
    });

    it('should reject quantity <= 0', () => {
      expect(() =>
        SalesOrderLine.create('l1', 'item-1', 'Test', 0, 100),
      ).toThrow('Quantity must be a positive number');
      expect(() =>
        SalesOrderLine.create('l1', 'item-1', 'Test', -1, 100),
      ).toThrow('Quantity must be a positive number');
    });

    it('should reject non-finite quantity', () => {
      expect(() =>
        SalesOrderLine.create('l1', 'item-1', 'Test', NaN, 100),
      ).toThrow('Quantity must be a positive number');
      expect(() =>
        SalesOrderLine.create('l1', 'item-1', 'Test', Infinity, 100),
      ).toThrow('Quantity must be a positive number');
    });

    it('should reject unitPrice < 0', () => {
      expect(() =>
        SalesOrderLine.create('l1', 'item-1', 'Test', 1, -100),
      ).toThrow('Unit price must not be negative');
    });
  });
});
