import { HandleInventoryReservedCommand } from './handle-inventory-reserved.command';
import { OrderHeader } from '../../domain/entities/order-header.entity';
import { OrderLine } from '../../domain/entities/order-line.entity';
import type { EventEnvelope, InventoryReservedPayload } from '@erp/shared';

describe('HandleInventoryReservedCommand', () => {
  let command: HandleInventoryReservedCommand;
  let mockRepo: { findByIdWithLines: jest.Mock; update: jest.Mock };
  let mockCustomerClient: { checkCredit: jest.Mock };

  const submittedOrder = () =>
    new OrderHeader({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'submitted',
      totalAmount: 5000,
      cancelReason: null,
      version: 1,
      lines: [
        new OrderLine({
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

  const envelope = (orderId: string): EventEnvelope => ({
    eventId: 'evt-1',
    eventType: 'inventory.reserved',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: null,
    payload: { orderId, reservationId: 'res-1' } as InventoryReservedPayload,
  });

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockCustomerClient = {
      checkCredit: jest.fn(),
    };
    command = new HandleInventoryReservedCommand(
      mockRepo as any,
      mockCustomerClient as any,
    );
  });

  it('should confirm order when credit is sufficient', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(submittedOrder());
    mockCustomerClient.checkCredit.mockResolvedValue({
      creditLimit: 10000,
      creditUsed: 0,
      available: 10000,
      sufficient: true,
    });

    await command.execute(envelope('order-1'));

    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    const updatedOrder = mockRepo.update.mock.calls[0][0] as OrderHeader;
    expect(updatedOrder.status).toBe('confirmed');
  });

  it('should cancel order when credit is insufficient', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(submittedOrder());
    mockCustomerClient.checkCredit.mockResolvedValue({
      creditLimit: 1000,
      creditUsed: 500,
      available: 500,
      sufficient: false,
    });

    await command.execute(envelope('order-1'));

    const updatedOrder = mockRepo.update.mock.calls[0][0] as OrderHeader;
    expect(updatedOrder.status).toBe('cancelled');
    expect(updatedOrder.cancelReason).toContain('Credit');
  });

  it('should cancel order when credit check throws error', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(submittedOrder());
    mockCustomerClient.checkCredit.mockRejectedValue(new Error('timeout'));

    await command.execute(envelope('order-1'));

    const updatedOrder = mockRepo.update.mock.calls[0][0] as OrderHeader;
    expect(updatedOrder.status).toBe('cancelled');
    expect(updatedOrder.cancelReason).toContain('timeout');
  });

  it('should skip if order not found', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(null);

    await command.execute(envelope('non-existent'));

    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should skip if order is not submitted', async () => {
    const confirmed = new OrderHeader({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'confirmed',
      totalAmount: 5000,
      cancelReason: null,
      version: 2,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(confirmed);

    await command.execute(envelope('order-1'));

    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});
