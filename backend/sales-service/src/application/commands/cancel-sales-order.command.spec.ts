import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CancelSalesOrderCommand } from './cancel-sales-order.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';

describe('CancelSalesOrderCommand', () => {
  let command: CancelSalesOrderCommand;
  let mockRepo: { findByIdWithLines: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    command = new CancelSalesOrderCommand(mockRepo as any);
  });

  it('should cancel a draft order', async () => {
    const draft = new SalesOrder({
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
    mockRepo.findByIdWithLines.mockResolvedValue(draft);

    const result = await command.execute('order-1', {
      reason: 'Khách hàng yêu cầu hủy đơn',
    });

    expect(result.status).toBe('cancelled');
    expect(result.cancelReason).toBe('Khách hàng yêu cầu hủy đơn');
    const events = mockRepo.update.mock.calls[0][1];
    expect(events).toHaveLength(0);
  });

  it('should cancel a confirmed order and emit order.cancelled event', async () => {
    const confirmed = new SalesOrder({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'confirmed',
      subtotalAmount: 5000,
      totalTaxAmount: 0,
      totalAmount: 5000,
      cancelReason: null,
      version: 2,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(confirmed);

    await command.execute('order-1', {
      reason: 'Đổi ý không mua nữa',
    });

    const events = mockRepo.update.mock.calls[0][1];
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('sales-order.cancelled');
  });

  it('should throw NotFoundException when order not found', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(null);

    await expect(
      command.execute('non-existent', { reason: 'test reason here' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when order is submitted', async () => {
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
      command.execute('order-1', { reason: 'test reason here' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject reason shorter than 5 chars', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(
      new SalesOrder({
        id: 'o1',
        customerId: 'c1',
        status: 'draft',
        subtotalAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 0,
        cancelReason: null,
        version: 0,
        lines: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(command.execute('o1', { reason: 'ab' })).rejects.toThrow();
  });
});
