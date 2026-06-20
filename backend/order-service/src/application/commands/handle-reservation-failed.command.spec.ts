import { HandleReservationFailedCommand } from './handle-reservation-failed.command';
import { OrderHeader } from '../../domain/entities/order-header.entity';
import type { EventEnvelope, InventoryReservationFailedPayload } from '@erp/shared';

describe('HandleReservationFailedCommand', () => {
  let command: HandleReservationFailedCommand;
  let mockRepo: { findByIdWithLines: jest.Mock; update: jest.Mock };

  const envelope = (orderId: string): EventEnvelope => ({
    eventId: 'evt-1',
    eventType: 'inventory.reservation-failed',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: null,
    payload: {
      orderId,
      reason: 'Không đủ tồn kho',
    } as InventoryReservationFailedPayload,
  });

  beforeEach(() => {
    mockRepo = {
      findByIdWithLines: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    command = new HandleReservationFailedCommand(mockRepo as any);
  });

  it('should cancel submitted order', async () => {
    const submitted = new OrderHeader({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'submitted',
      totalAmount: 5000,
      cancelReason: null,
      version: 1,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.findByIdWithLines.mockResolvedValue(submitted);

    await command.execute(envelope('order-1'));

    const updatedOrder = mockRepo.update.mock.calls[0][0] as OrderHeader;
    expect(updatedOrder.status).toBe('cancelled');
    expect(updatedOrder.cancelReason).toContain('inventory');
    const events = mockRepo.update.mock.calls[0][1];
    expect(events).toHaveLength(0);
  });

  it('should skip if order not found', async () => {
    mockRepo.findByIdWithLines.mockResolvedValue(null);

    await command.execute(envelope('non-existent'));

    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should skip if order is not submitted', async () => {
    const draft = new OrderHeader({
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
    mockRepo.findByIdWithLines.mockResolvedValue(draft);

    await command.execute(envelope('order-1'));

    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});
