import { CreateOrderCommand } from './create-order.command';
import { OrderHeader } from '../../domain/entities/order-header.entity';

describe('CreateOrderCommand', () => {
  let command: CreateOrderCommand;
  let mockRepo: { create: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockImplementation((order: OrderHeader) => Promise.resolve(order)),
    };
    command = new CreateOrderCommand(mockRepo as any);
  });

  it('should create a draft order with valid customerId', async () => {
    const result = await command.execute({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.status).toBe('draft');
    expect(result.customerId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
  });

  it('should reject invalid customerId', async () => {
    await expect(
      command.execute({ customerId: 'not-a-uuid' }),
    ).rejects.toThrow();
  });

  it('should reject missing customerId', async () => {
    await expect(command.execute({})).rejects.toThrow();
  });
});
