import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmitSalesOrderCommand } from './submit-sales-order.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';
import { SalesOrderLine } from '../../domain/entities/sales-order-line.entity';

describe('SubmitSalesOrderCommand', () => {
  let command: SubmitSalesOrderCommand;
  let mockRepo: { findByIdWithLines: jest.Mock; update: jest.Mock };

  const draftWithLines = () => {
    const order = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'draft',
      totalAmount: 5000,
      cancelReason: null,
      version: 0,
      lines: [
        new SalesOrderLine({
          id: 'l1',
          itemId: 'item-1',
          itemName: 'Test Item',
          quantity: 5,
          unitPrice: 1000,
          lineTotal: 5000,
          createdAt: new Date(),
        }),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return order;
  };

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    command = new SubmitSalesOrderCommand(mockRepo as any);
  });

  it('should submit a draft order with lines', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(draftWithLines());

    const result = await command.execute('order-1');

    expect(result.status).toBe('submitted');
    expect(result.message).toContain('Saga');
    expect(mockRepo.update).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when order not found', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(null);

    await expect(command.execute('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when order has no lines', async () => {
    const emptyDraft = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'draft',
      totalAmount: 0,
      cancelReason: null,
      version: 0,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(emptyDraft);

    await expect(command.execute('order-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when order is not draft', async () => {
    const submitted = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'submitted',
      totalAmount: 5000,
      cancelReason: null,
      version: 1,
      lines: [
        new SalesOrderLine({
          id: 'l1',
          itemId: 'item-1',
          itemName: 'Test',
          quantity: 5,
          unitPrice: 1000,
          lineTotal: 5000,
          createdAt: new Date(),
        }),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(submitted);

    await expect(command.execute('order-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
