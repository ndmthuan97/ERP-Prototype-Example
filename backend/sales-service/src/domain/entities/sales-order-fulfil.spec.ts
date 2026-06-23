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

describe('SalesOrder.fulfil()', () => {
  it('should transition from confirmed to fulfilled', () => {
    const order = createConfirmedOrder();

    order.fulfil();

    expect(order.status).toBe('fulfilled');
  });

  it('should update updatedAt timestamp', () => {
    const order = createConfirmedOrder();
    const beforeFulfil = order.updatedAt;

    order.fulfil();

    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeFulfil.getTime());
  });

  it('should throw InvalidStatusTransitionError when status is draft', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');

    expect(() => order.fulfil()).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when status is submitted', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');
    order.addLine(createLine());
    order.submit();

    expect(() => order.fulfil()).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when status is cancelled', () => {
    const order = SalesOrder.createDraft('order-1', 'customer-1');
    order.cancel('test reason');

    expect(() => order.fulfil()).toThrow(InvalidStatusTransitionError);
  });

  it('should throw InvalidStatusTransitionError when already fulfilled', () => {
    const order = createConfirmedOrder();
    order.fulfil();

    expect(() => order.fulfil()).toThrow(InvalidStatusTransitionError);
  });
});
