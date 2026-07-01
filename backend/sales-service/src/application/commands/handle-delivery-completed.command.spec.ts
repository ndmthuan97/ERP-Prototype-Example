import { HandleDeliveryCompletedCommand } from './handle-delivery-completed.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';
import { SalesOrderLine } from '../../domain/entities/sales-order-line.entity';
import { DeliveryOrder } from '../../domain/entities/delivery-order.entity';
import { DeliveryLine } from '../../domain/entities/delivery-line.entity';

function soLine(id: string, itemId: string, quantity: number): SalesOrderLine {
  return new SalesOrderLine({
    id,
    itemId,
    itemName: `Item ${itemId}`,
    quantity,
    unitPrice: 100,
    taxRate: 0.1,
    taxAmount: 10 * quantity,
    lineTotal: 110 * quantity,
    createdAt: new Date(),
  });
}

function makeOrder(lines: SalesOrderLine[]): SalesOrder {
  return new SalesOrder({
    id: 'order-1',
    customerId: 'cust-1',
    status: 'confirmed',
    subtotalAmount: 0,
    totalTaxAmount: 0,
    totalAmount: 0,
    cancelReason: null,
    version: 1,
    lines,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function delLine(
  salesOrderLineId: string,
  itemId: string,
  quantity: number,
): DeliveryLine {
  return new DeliveryLine({
    id: `dl-${salesOrderLineId}`,
    salesOrderLineId,
    itemId,
    itemName: `Item ${itemId}`,
    quantity,
  });
}

function deliveredDO(id: string, lines: DeliveryLine[]): DeliveryOrder {
  return new DeliveryOrder({
    id,
    salesOrderId: 'order-1',
    status: 'delivered',
    failReason: null,
    version: 1,
    lines,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('HandleDeliveryCompletedCommand — inventory issue emission', () => {
  let soRepo: { findByIdWithLines: jest.Mock; update: jest.Mock };
  let deliveryRepo: { findBySalesOrderId: jest.Mock };
  let command: HandleDeliveryCompletedCommand;

  beforeEach(() => {
    soRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    deliveryRepo = { findBySalesOrderId: jest.fn() };
    command = new HandleDeliveryCompletedCommand(
      soRepo as any,
      deliveryRepo as any,
    );
  });

  it('emits sales-order.fulfilled with ONLY the just-delivered DO lines (full)', async () => {
    soRepo.findByIdWithLines.mockResolvedValue(
      makeOrder([soLine('line-1', 'item-1', 10), soLine('line-2', 'item-2', 5)]),
    );
    const do1 = deliveredDO('do-1', [
      delLine('line-1', 'item-1', 10),
      delLine('line-2', 'item-2', 5),
    ]);
    deliveryRepo.findBySalesOrderId.mockResolvedValue([do1]);

    const result = await command.execute('order-1', 'do-1');

    expect(result.allLinesDelivered).toBe(true);
    expect(result.status).toBe('fully_delivered');

    const events = soRepo.update.mock.calls[0][1];
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('sales-order.fulfilled');
    expect(events[0].payload.orderId).toBe('order-1');
    expect(events[0].payload.lines).toEqual([
      { itemId: 'item-1', quantity: 10 },
      { itemId: 'item-2', quantity: 5 },
    ]);
  });

  it('emits only the delta for a partial delivery', async () => {
    soRepo.findByIdWithLines.mockResolvedValue(
      makeOrder([soLine('line-1', 'item-1', 10)]),
    );
    // Only 6 of 10 delivered so far
    const do1 = deliveredDO('do-1', [delLine('line-1', 'item-1', 6)]);
    deliveryRepo.findBySalesOrderId.mockResolvedValue([do1]);

    const result = await command.execute('order-1', 'do-1');

    expect(result.allLinesDelivered).toBe(false);
    expect(result.status).toBe('partially_delivered');

    const events = soRepo.update.mock.calls[0][1];
    expect(events[0].payload.lines).toEqual([{ itemId: 'item-1', quantity: 6 }]);
  });

  it('emits no event when the delivered DO id is unknown (no stock issued)', async () => {
    soRepo.findByIdWithLines.mockResolvedValue(
      makeOrder([soLine('line-1', 'item-1', 10)]),
    );
    deliveryRepo.findBySalesOrderId.mockResolvedValue([
      deliveredDO('do-1', [delLine('line-1', 'item-1', 10)]),
    ]);

    await command.execute('order-1', 'does-not-exist');

    const events = soRepo.update.mock.calls[0][1];
    expect(events).toHaveLength(0);
  });
});
