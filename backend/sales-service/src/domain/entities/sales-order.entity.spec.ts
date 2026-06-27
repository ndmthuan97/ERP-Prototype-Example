import {
  SalesOrder,
  InvalidStatusTransitionError,
  EmptyOrderError,
} from './sales-order.entity';
import { SalesOrderLine } from './sales-order-line.entity';

function createLine(overrides: Partial<{ id: string; quantity: number; unitPrice: number }> = {}): SalesOrderLine {
  return SalesOrderLine.create(
    overrides.id ?? 'line-1',
    'item-1',
    'Test Item',
    overrides.quantity ?? 5,
    overrides.unitPrice ?? 1000,
  );
}

describe('SalesOrder', () => {
  describe('createDraft', () => {
    it('should create a draft order with empty lines and zero total', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');

      expect(order.id).toBe('order-1');
      expect(order.customerId).toBe('customer-1');
      expect(order.status).toBe('draft');
      expect(order.totalAmount).toBe(0);
      expect(order.cancelReason).toBeNull();
      expect(order.version).toBe(0);
      expect(order.lines).toHaveLength(0);
    });
  });

  describe('addLine', () => {
    it('should add a line and recalculate totalAmount', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      const line = createLine({ quantity: 3, unitPrice: 2000 });

      order.addLine(line);

      expect(order.lines).toHaveLength(1);
      expect(order.totalAmount).toBe(6000);
    });

    it('should accumulate totals from multiple lines', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine({ id: 'l1', quantity: 2, unitPrice: 1000 }));
      order.addLine(createLine({ id: 'l2', quantity: 3, unitPrice: 500 }));

      expect(order.lines).toHaveLength(2);
      expect(order.totalAmount).toBe(3500);
    });

    it('should reject addLine when not draft', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      expect(() => order.addLine(createLine({ id: 'l2' }))).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe('submit', () => {
    it('should transition from draft to submitted', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());

      order.submit();

      expect(order.status).toBe('submitted');
    });

    it('should throw EmptyOrderError when no lines', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');

      expect(() => order.submit()).toThrow(EmptyOrderError);
    });

    it('should reject submit when not draft', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      expect(() => order.submit()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('confirm', () => {
    it('should transition from submitted to confirmed', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      order.confirm();

      expect(order.status).toBe('confirmed');
    });

    it('should reject confirm when not submitted', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');

      expect(() => order.confirm()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('cancel', () => {
    it('should cancel from draft', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');

      order.cancel('Test reason for cancel');

      expect(order.status).toBe('cancelled');
      expect(order.cancelReason).toBe('Test reason for cancel');
    });

    it('should cancel from confirmed', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();
      order.confirm();

      order.cancel('Customer requested cancellation');

      expect(order.status).toBe('cancelled');
    });

    it('should reject cancel from submitted (submit flow is processing)', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      expect(() => order.cancel('reason')).toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('should reject cancel from fully_delivered', () => {
      const order = new SalesOrder({
        id: 'o1',
        customerId: 'c1',
        status: 'fully_delivered',
        subtotalAmount: 1000,
        totalTaxAmount: 0,
        totalAmount: 1000,
        cancelReason: null,
        version: 5,
        lines: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => order.cancel('reason')).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe('compensation', () => {
    it('markFailedNoStock should cancel submitted order', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      order.markFailedNoStock();

      expect(order.status).toBe('cancelled');
      expect(order.cancelReason).toContain('stock');
    });

    it('markFailedCredit should cancel submitted order', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');
      order.addLine(createLine());
      order.submit();

      order.markFailedCredit('Insufficient credit limit');

      expect(order.status).toBe('cancelled');
      expect(order.cancelReason).toBe('Insufficient credit limit');
    });

    it('markFailedNoStock should reject when not submitted', () => {
      const order = SalesOrder.createDraft('order-1', 'customer-1');

      expect(() => order.markFailedNoStock()).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });
});
