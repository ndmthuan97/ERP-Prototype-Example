import { UpdateSalesReturnStatusCommand } from './update-sales-return-status.command';
import { SalesReturn } from '../../domain/entities/sales-return.entity';
import { SalesReturnLine } from '../../domain/entities/sales-return-line.entity';

function makeApprovedReturn(): SalesReturn {
  const line = new SalesReturnLine({
    id: 'rl-1',
    salesOrderLineId: 'sol-1',
    itemId: 'item-1',
    itemName: 'Widget',
    quantity: 3,
    unitPrice: 100,
    reason: 'damaged',
  });
  return new SalesReturn({
    id: 'ret-1',
    salesOrderId: 'order-1',
    customerId: 'cust-1',
    status: 'approved',
    reason: 'customer return',
    totalRefundAmount: 300,
    lines: [line],
    approvedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateSalesReturnStatusCommand — restock emission', () => {
  let repo: { findById: jest.Mock; update: jest.Mock };
  let command: UpdateSalesReturnStatusCommand;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      update: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    command = new UpdateSalesReturnStatusCommand(repo as any);
  });

  it('emits sales-return.goods-received with the returned lines on receive_goods', async () => {
    repo.findById.mockResolvedValue(makeApprovedReturn());

    await command.execute('ret-1', 'receive_goods');

    const events = repo.update.mock.calls[0][1];
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('sales-return.goods-received');
    expect(events[0].payload.returnId).toBe('ret-1');
    expect(events[0].payload.orderId).toBe('order-1');
    expect(events[0].payload.lines).toEqual([{ itemId: 'item-1', quantity: 3 }]);
  });

  it('does not emit a restock event on approve', async () => {
    const draftReturn = new SalesReturn({
      id: 'ret-2',
      salesOrderId: 'order-2',
      customerId: 'cust-2',
      status: 'draft',
      reason: 'customer return',
      totalRefundAmount: 0,
      lines: [
        new SalesReturnLine({
          id: 'rl-2',
          salesOrderLineId: 'sol-2',
          itemId: 'item-2',
          itemName: 'Gadget',
          quantity: 1,
          unitPrice: 50,
          reason: null,
        }),
      ],
      approvedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.findById.mockResolvedValue(draftReturn);

    await command.execute('ret-2', 'approve');

    const events = repo.update.mock.calls[0][1];
    expect(events).toHaveLength(0);
  });
});
