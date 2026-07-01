// =============================================================================
// INTEGRATED FLOW TESTS — Full Order-to-Return Domain Flow
// =============================================================================
// Tests complete business flows at the domain entity level:
// 1. SO lifecycle with VAT calculation
// 2. Saga compensation scenarios
// 3. Partial delivery flow
// 4. Return after fully_delivered

import { SalesOrder, InvalidStatusTransitionError } from './sales-order.entity';
import { SalesOrderLine } from './sales-order-line.entity';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryLine } from './delivery-line.entity';
import { SalesReturn } from './sales-return.entity';
import { SalesReturnLine } from './sales-return-line.entity';

// === Helpers ==============================================================

function createLine(
  opts: {
    id?: string;
    itemId?: string;
    name?: string;
    qty?: number;
    price?: number;
    taxRate?: number;
  } = {},
): SalesOrderLine {
  return SalesOrderLine.create(
    opts.id ?? 'line-1',
    opts.itemId ?? 'item-1',
    opts.name ?? 'Widget A',
    opts.qty ?? 10,
    opts.price ?? 1000,
    opts.taxRate ?? 0.1,
  );
}

function createConfirmedOrder(lines?: SalesOrderLine[]): SalesOrder {
  const order = SalesOrder.createDraft('so-1', 'cust-1');
  for (const line of lines ?? [createLine()]) {
    order.addLine(line);
  }
  order.submit();
  order.confirm();
  return order;
}

function deliverDO(delivery: DeliveryOrder): void {
  delivery.startPicking();
  delivery.pack();
  delivery.ship();
  delivery.confirmDelivery();
}

// ==========================================================================
// FLOW 1: Sales Order Lifecycle with VAT Calculation
// ==========================================================================
describe('Flow 1: Sales Order Lifecycle + VAT', () => {
  it('should calculate correct subtotal, tax, and total on addLine', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');

    // Line: 10 × 1000 @ 10% VAT = subtotal 10000, tax 1000, total 11000
    order.addLine(createLine({ qty: 10, price: 1000, taxRate: 0.1 }));

    expect(order.subtotalAmount).toBe(10000);
    expect(order.totalTaxAmount).toBe(1000);
    expect(order.totalAmount).toBe(11000);
  });

  it('should accumulate totals across multiple lines', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');

    // Line 1: 10 × 1000 @ 10% = subtotal 10000, tax 1000
    order.addLine(createLine({ id: 'l1', qty: 10, price: 1000, taxRate: 0.1 }));
    // Line 2: 5 × 2000 @ 8% = subtotal 10000, tax 800
    order.addLine(createLine({ id: 'l2', qty: 5, price: 2000, taxRate: 0.08 }));

    expect(order.subtotalAmount).toBe(20000);
    expect(order.totalTaxAmount).toBe(1800);
    expect(order.totalAmount).toBe(21800);
  });

  it('should allow unitPrice = 0 (free promotional item)', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');

    const freeLine = createLine({ id: 'l1', price: 0 });
    order.addLine(freeLine);
    // Must have a paid line to have meaningful total
    order.addLine(createLine({ id: 'l2', qty: 1, price: 5000, taxRate: 0.1 }));

    expect(freeLine.lineTotal).toBe(0);
    expect(order.subtotalAmount).toBe(5000);
  });

  it('should allow decimal quantity', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.addLine(createLine({ qty: 2.5, price: 1000, taxRate: 0.05 }));

    // 2.5 × 1000 = 2500, tax = 125, total = 2625
    expect(order.subtotalAmount).toBe(2500);
    expect(order.totalTaxAmount).toBe(125);
    expect(order.totalAmount).toBe(2625);
  });

  it('full lifecycle: draft → submitted → confirmed → fully_delivered', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.addLine(createLine());

    order.submit();
    expect(order.status).toBe('submitted');

    order.confirm();
    expect(order.status).toBe('confirmed');

    order.recordDelivery(true);
    expect(order.status).toBe('fully_delivered');
  });
});

// ==========================================================================
// FLOW 2: Saga Compensation
// ==========================================================================
describe('Flow 2: Saga Compensation Scenarios', () => {
  it('should cancel on inventory reservation failure', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.addLine(createLine());
    order.submit();

    order.markFailedNoStock();

    expect(order.status).toBe('cancelled');
    expect(order.cancelReason).toContain('Insufficient stock');
  });

  it('should cancel on credit check failure', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.addLine(createLine());
    order.submit();

    order.markFailedCredit(
      'Insufficient credit: required 50000, available 10000',
    );

    expect(order.status).toBe('cancelled');
    expect(order.cancelReason).toContain('Insufficient credit');
  });

  it('should prevent cancel from submitted (saga in progress)', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.addLine(createLine());
    order.submit();

    // Direct cancel not allowed during saga
    expect(() => order.cancel('user wants to cancel')).toThrow(
      InvalidStatusTransitionError,
    );
  });

  it('should prevent any action on cancelled order', () => {
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    order.cancel('no longer needed');

    expect(() => order.submit()).toThrow(InvalidStatusTransitionError);
    expect(() => order.confirm()).toThrow(InvalidStatusTransitionError);
    expect(() => order.recordDelivery(true)).toThrow(
      InvalidStatusTransitionError,
    );
  });
});

// ==========================================================================
// FLOW 3: Partial Delivery
// ==========================================================================
describe('Flow 3: Partial Delivery Flow', () => {
  it('single delivery — all lines → fully_delivered', () => {
    const lineA = createLine({ id: 'l-a', itemId: 'A', qty: 10 });
    const lineB = createLine({ id: 'l-b', itemId: 'B', qty: 5 });
    const order = createConfirmedOrder([lineA, lineB]);

    // Create DO with all items
    const do1 = DeliveryOrder.createFromOrder('do-1', order.id);
    do1.addLine(DeliveryLine.create('dl-1', lineA.id, 'A', 'Widget A', 10));
    do1.addLine(DeliveryLine.create('dl-2', lineB.id, 'B', 'Widget B', 5));
    deliverDO(do1);

    // All lines fully delivered
    order.recordDelivery(true);
    expect(order.status).toBe('fully_delivered');
  });

  it('two partial deliveries → partially_delivered → fully_delivered', () => {
    const lineA = createLine({ id: 'l-a', itemId: 'A', qty: 10 });
    const lineB = createLine({ id: 'l-b', itemId: 'B', qty: 5 });
    const order = createConfirmedOrder([lineA, lineB]);

    // DO#1: deliver partial A=6, all B=5
    const do1 = DeliveryOrder.createFromOrder('do-1', order.id);
    do1.addLine(DeliveryLine.create('dl-1', lineA.id, 'A', 'Widget A', 6));
    do1.addLine(DeliveryLine.create('dl-2', lineB.id, 'B', 'Widget B', 5));
    deliverDO(do1);

    order.recordDelivery(false); // Not all A delivered
    expect(order.status).toBe('partially_delivered');

    // DO#2: deliver remaining A=4
    const do2 = DeliveryOrder.createFromOrder('do-2', order.id);
    do2.addLine(DeliveryLine.create('dl-3', lineA.id, 'A', 'Widget A', 4));
    deliverDO(do2);

    order.recordDelivery(true); // Now all lines fully delivered
    expect(order.status).toBe('fully_delivered');
  });

  it('delivery failure does not change SO status', () => {
    const order = createConfirmedOrder();

    const do1 = DeliveryOrder.createFromOrder('do-1', order.id);
    do1.addLine(DeliveryLine.create('dl-1', 'line-1', 'item-1', 'Widget', 10));
    do1.startPicking();
    do1.pack();
    do1.ship();
    do1.markFailed('Customer refused');

    // SO remains confirmed because no delivery completed
    expect(order.status).toBe('confirmed');
    expect(do1.status).toBe('failed');
    expect(do1.failReason).toBe('Customer refused');
  });

  it('cancel from partially_delivered', () => {
    const order = createConfirmedOrder();
    order.recordDelivery(false);

    expect(order.status).toBe('partially_delivered');

    order.cancel('Customer requested cancellation');
    expect(order.status).toBe('cancelled');
    expect(order.cancelReason).toBe('Customer requested cancellation');
  });

  it('cannot cancel from fully_delivered', () => {
    const order = createConfirmedOrder();
    order.recordDelivery(true);

    expect(order.status).toBe('fully_delivered');
    expect(() => order.cancel('too late')).toThrow(
      InvalidStatusTransitionError,
    );
  });
});

// ==========================================================================
// FLOW 4: Sales Return after Full Delivery
// ==========================================================================
describe('Flow 4: Sales Return Flow', () => {
  it('happy path: create return → approve → receiveGoods → complete', () => {
    // Step 1: Fully deliver an order
    const order = createConfirmedOrder([
      createLine({ id: 'l1', qty: 10, price: 1000 }),
    ]);
    order.recordDelivery(true);
    expect(order.status).toBe('fully_delivered');

    // Step 2: Create return
    const ret = SalesReturn.createDraft(
      'ret-1',
      order.id,
      order.customerId,
      'Defective batch',
    );
    expect(ret.status).toBe('draft');

    // Step 3: Add return lines (return 3 of 10 units)
    ret.addLine(
      SalesReturnLine.create(
        'srl-1',
        'l1',
        'item-1',
        'Widget A',
        3,
        1000,
        'Scratched',
      ),
    );
    expect(ret.totalRefundAmount).toBe(3000); // 3 × 1000

    // Step 4: Approve
    ret.approve();
    expect(ret.status).toBe('approved');
    expect(ret.approvedAt).not.toBeNull();

    // Step 5: Receive goods
    ret.receiveGoods();
    expect(ret.status).toBe('goods_received');

    // Step 6: Complete
    ret.complete();
    expect(ret.status).toBe('completed');
    expect(ret.completedAt).not.toBeNull();
  });

  it('multiple returns for the same order', () => {
    const order = createConfirmedOrder([
      createLine({ id: 'l1', qty: 10, price: 1000 }),
      createLine({ id: 'l2', itemId: 'item-2', qty: 5, price: 2000 }),
    ]);
    order.recordDelivery(true);

    // Return #1: 3 units of item-1
    const ret1 = SalesReturn.createDraft(
      'ret-1',
      order.id,
      order.customerId,
      'Wrong size',
    );
    ret1.addLine(
      SalesReturnLine.create('srl-1', 'l1', 'item-1', 'Widget A', 3, 1000),
    );
    expect(ret1.totalRefundAmount).toBe(3000);

    // Return #2: 2 units of item-2
    const ret2 = SalesReturn.createDraft(
      'ret-2',
      order.id,
      order.customerId,
      'Damaged in transit',
    );
    ret2.addLine(
      SalesReturnLine.create('srl-2', 'l2', 'item-2', 'Widget B', 2, 2000),
    );
    expect(ret2.totalRefundAmount).toBe(4000);

    // Both returns are independent
    ret1.approve();
    ret2.reject();

    expect(ret1.status).toBe('approved');
    expect(ret2.status).toBe('rejected');
  });

  it('return with decimal quantity', () => {
    const ret = SalesReturn.createDraft(
      'ret-1',
      'so-1',
      'c1',
      'Excess material',
    );
    ret.addLine(
      SalesReturnLine.create('srl-1', 'l1', 'item-1', 'Fabric', 1.5, 200),
    );

    expect(ret.totalRefundAmount).toBe(300); // 1.5 × 200
  });
});

// ==========================================================================
// FLOW 5: End-to-End Happy Path (Domain Only)
// ==========================================================================
describe('Flow 5: Full End-to-End — Order → Deliver → Return', () => {
  it('complete business cycle with VAT + partial delivery + return', () => {
    // === Step 1: Create Order with Tax ===
    const order = SalesOrder.createDraft('so-1', 'cust-1');
    const lineA = createLine({
      id: 'la',
      itemId: 'A',
      name: 'Laptop',
      qty: 3,
      price: 15000000,
      taxRate: 0.1,
    });
    const lineB = createLine({
      id: 'lb',
      itemId: 'B',
      name: 'Mouse',
      qty: 10,
      price: 200000,
      taxRate: 0.1,
    });
    order.addLine(lineA);
    order.addLine(lineB);

    // Verify tax calculation
    // Laptop: 3×15M = 45M, tax = 4.5M
    // Mouse: 10×200K = 2M, tax = 200K
    expect(order.subtotalAmount).toBe(47000000);
    expect(order.totalTaxAmount).toBe(4700000);
    expect(order.totalAmount).toBe(51700000);

    // === Step 2: Submit + Saga Confirm ===
    order.submit();
    expect(order.status).toBe('submitted');
    order.confirm();
    expect(order.status).toBe('confirmed');

    // === Step 3: Partial Delivery #1 (Laptops only) ===
    const do1 = DeliveryOrder.createFromOrder('do-1', 'so-1');
    do1.addLine(DeliveryLine.create('dl-1', 'la', 'A', 'Laptop', 3));
    deliverDO(do1);

    order.recordDelivery(false); // Mouse not yet delivered
    expect(order.status).toBe('partially_delivered');

    // === Step 4: Partial Delivery #2 (Mice) ===
    const do2 = DeliveryOrder.createFromOrder('do-2', 'so-1');
    do2.addLine(DeliveryLine.create('dl-2', 'lb', 'B', 'Mouse', 10));
    deliverDO(do2);

    order.recordDelivery(true); // All lines delivered
    expect(order.status).toBe('fully_delivered');

    // === Step 5: Sales Return (1 defective laptop) ===
    const ret = SalesReturn.createDraft(
      'ret-1',
      'so-1',
      'cust-1',
      'Defective screen',
    );
    ret.addLine(
      SalesReturnLine.create(
        'srl-1',
        'la',
        'A',
        'Laptop',
        1,
        15000000,
        'Dead pixels',
      ),
    );
    expect(ret.totalRefundAmount).toBe(15000000);

    ret.approve();
    ret.receiveGoods();
    ret.complete();

    expect(ret.status).toBe('completed');
    expect(ret.completedAt).not.toBeNull();
  });
});
