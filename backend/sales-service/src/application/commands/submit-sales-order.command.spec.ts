import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmitSalesOrderCommand } from './submit-sales-order.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';
import { SalesOrderLine } from '../../domain/entities/sales-order-line.entity';

describe('SubmitSalesOrderCommand', () => {
  let command: SubmitSalesOrderCommand;
  let mockRepo: {
    findByIdWithLines: jest.Mock;
    update: jest.Mock;
    sumPendingOrdersTotal: jest.Mock;
  };
  let mockInventoryClient: {
    reserveBatch: jest.Mock;
    releaseBatch: jest.Mock;
  };
  let mockCustomerClient: {
    checkCredit: jest.Mock;
  };

  const draftWithLines = () =>
    new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'draft',
      subtotalAmount: 5000,
      totalTaxAmount: 0,
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
          taxRate: 0,
          taxAmount: 0,
          lineTotal: 5000,
          createdAt: new Date(),
        }),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      sumPendingOrdersTotal: jest.fn().mockResolvedValue(0),
    };
    mockInventoryClient = {
      reserveBatch: jest.fn(),
      releaseBatch: jest.fn().mockResolvedValue({ released: true }),
    };
    mockCustomerClient = {
      checkCredit: jest.fn(),
    };
    command = new SubmitSalesOrderCommand(
      mockRepo as any,
      mockInventoryClient as any,
      mockCustomerClient as any,
    );
  });

  it('should confirm order when reserve + credit both succeed', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(draftWithLines());
    mockInventoryClient.reserveBatch.mockResolvedValue({
      reserved: true,
      reservationId: 'res-1',
      orderId: 'order-1',
    });
    mockCustomerClient.checkCredit.mockResolvedValue({
      available: 100000,
      sufficient: true,
    });

    const result = await command.execute('order-1');

    expect(result.status).toBe('confirmed');
    // 3 updates: submitted, confirmed (skip cancelled)
    expect(mockRepo.update).toHaveBeenCalledTimes(2);
  });

  it('should cancel order when reserve fails (insufficient stock)', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(draftWithLines());
    mockInventoryClient.reserveBatch.mockResolvedValue({
      reserved: false,
      reservationId: '',
      orderId: 'order-1',
    });

    const result = await command.execute('order-1');

    expect(result.status).toBe('cancelled');
    expect(result.reason).toContain('stock');
    expect(mockCustomerClient.checkCredit).not.toHaveBeenCalled();
  });

  it('should cancel + release when credit check fails', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(draftWithLines());
    mockInventoryClient.reserveBatch.mockResolvedValue({
      reserved: true,
      reservationId: 'res-1',
      orderId: 'order-1',
    });
    mockCustomerClient.checkCredit.mockResolvedValue({
      available: 100,
      sufficient: false,
    });

    const result = await command.execute('order-1');

    expect(result.status).toBe('cancelled');
    expect(result.reason).toContain('credit');
    expect(mockInventoryClient.releaseBatch).toHaveBeenCalledTimes(1);
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
      subtotalAmount: 0,
      totalTaxAmount: 0,
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
    const confirmed = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'confirmed',
      subtotalAmount: 5000,
      totalTaxAmount: 0,
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
          taxRate: 0,
          taxAmount: 0,
          lineTotal: 5000,
          createdAt: new Date(),
        }),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(confirmed);

    await expect(command.execute('order-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
