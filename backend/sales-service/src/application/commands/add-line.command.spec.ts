import { NotFoundException } from '@nestjs/common';
import { AddLineCommand } from './add-line.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';

describe('AddLineCommand', () => {
  let command: AddLineCommand;
  let mockRepo: { findByIdWithLines: jest.Mock; addLine: jest.Mock };

  const draftOrder = () =>
    new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'draft',
      subtotalAmount: 0,
      totalTaxAmount: 0,
      totalAmount: 0,
      cancelReason: null,
      version: 0,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      addLine: jest
        .fn()
        .mockImplementation((order: SalesOrder) => Promise.resolve(order)),
    };
    command = new AddLineCommand(mockRepo as any);
  });

  it('should add a line to a draft order', async () => {
    const order = draftOrder();
    mockRepo.findByIdWithLines.mockResolvedValue(order);

    await command.execute('order-1', {
      itemId: '550e8400-e29b-41d4-a716-446655440000',
      itemName: 'Bàn gỗ',
      quantity: 5,
      unitPrice: 1000,
    });

    expect(mockRepo.addLine).toHaveBeenCalledTimes(1);
    // The domain entity should have the line added
    const calledWith = mockRepo.addLine.mock.calls[0][0] as SalesOrder;
    expect(calledWith.lines).toHaveLength(1);
    expect(Number(calledWith.totalAmount)).toBe(5000);
  });

  it('should throw NotFoundException when order not found', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(null);

    await expect(
      command.execute('non-existent', {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject when order is not draft', async () => {
    const submitted = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'submitted',
      subtotalAmount: 1000,
      totalTaxAmount: 0,
      totalAmount: 1000,
      cancelReason: null,
      version: 1,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(submitted);

    await expect(
      command.execute('order-1', {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
      }),
    ).rejects.toThrow();
  });

  it('should reject invalid dto', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(draftOrder());

    await expect(
      command.execute('order-1', { quantity: -1 }),
    ).rejects.toThrow();
  });
});
