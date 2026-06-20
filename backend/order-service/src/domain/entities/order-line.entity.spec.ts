import { OrderLine } from './order-line.entity';

describe('OrderLine', () => {
  describe('create', () => {
    it('should calculate lineTotal = quantity × unitPrice', () => {
      const line = OrderLine.create('l1', 'item-1', 'Bàn gỗ', 10, 1500000);

      expect(line.quantity).toBe(10);
      expect(line.unitPrice).toBe(1500000);
      expect(line.lineTotal).toBe(15000000);
    });

    it('should store itemName snapshot', () => {
      const line = OrderLine.create('l1', 'item-1', 'Tên sản phẩm', 1, 100);
      expect(line.itemName).toBe('Tên sản phẩm');
    });

    it('should reject quantity <= 0', () => {
      expect(() => OrderLine.create('l1', 'item-1', 'Test', 0, 100)).toThrow(
        'Số lượng phải là số nguyên dương',
      );
      expect(() => OrderLine.create('l1', 'item-1', 'Test', -1, 100)).toThrow(
        'Số lượng phải là số nguyên dương',
      );
    });

    it('should reject non-integer quantity', () => {
      expect(() => OrderLine.create('l1', 'item-1', 'Test', 1.5, 100)).toThrow(
        'Số lượng phải là số nguyên dương',
      );
    });

    it('should reject unitPrice <= 0', () => {
      expect(() => OrderLine.create('l1', 'item-1', 'Test', 1, 0)).toThrow(
        'Đơn giá phải là số dương',
      );
      expect(() => OrderLine.create('l1', 'item-1', 'Test', 1, -100)).toThrow(
        'Đơn giá phải là số dương',
      );
    });
  });
});
