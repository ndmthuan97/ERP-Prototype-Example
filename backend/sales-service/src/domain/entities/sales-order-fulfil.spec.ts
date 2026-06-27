import {
  SalesOrder,
  InvalidStatusTransitionError,
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

/** Helper: builds a confirmed order (draft → submitted → confirmed) */
function createConfirmedOrder(): SalesOrder {
  const order = SalesOrder.createDraft('order-1', 'customer-1');
  order.addLine(createLine());
  order.submit();
  order.confirm();
  return order;
}

describe('SalesOrder.recordDelivery()', () => {
  it('should transition from confirmed to fully_delivered when all lines delivered', () => {
    const order = createConfirmedOrder();

    order.recordDelivery(true);

    expect(order.status).toBe('fully_delivered');
  });

  it('should transition from confirmed to partially_delivered when not all lines delivered', () => {
    const order = createConfirmedOrder();

    order.recordDelivery(false);

    expect(order.status).toBe('partially_delivered');
  });

  it('should transition from partially_delivered to fully_delivered', () => {
    const order = createConfirmedOrder();
    order.recordDelivery(false);
    expect(order.status).toBe('partially_delivered');

    order.recordDelivery(true);
    expect(order.status).toBe('fully_delivered');
  });

  it('should update updatedAt timestamp', () => {
    const order = createConfirmedOrder();
    const beforeFulfil = order.updatedAt;

    order.recordDelivery(true);

    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeFulfil.getTime());
  });

  it('should throw InvalidStatusTransitionError when status is draft', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');

    expect(() => order.recordDelivery(true)).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when status is submitted', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');
    order.addLine(createLine());
    order.submit();

    expect(() => order.recordDelivery(true)).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when status is cancelled', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');
    order.cancel('test reason');

    expect(() => order.recordDelivery(true)).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when already fully_delivered', () => {
    const order = createConfirmedOrder();
    order.recordDelivery(true);

    expect(() => order.recordDelivery(true)).toThrow(InvalidStatusTransitionError);
  });

  it('should allow cancel from partially_delivered status', () => {
    const order = createConfirmedOrder();
    order.recordDelivery(false);
    expect(order.status).toBe('partially_delivered');

    order.cancel('customer request');
    expect(order.status).toBe('cancelled');
  });
});
