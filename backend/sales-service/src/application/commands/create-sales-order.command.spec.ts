import { CreateSalesOrderCommand } from './create-sales-order.command';
import { SalesOrder } from '../../domain/entities/sales-order.entity';

describe('CreateSalesOrderCommand', () => {
  let command: CreateSalesOrderCommand;
  let mockRepo: { create: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      create: jest
        .fn()
        .mockImplementation((order: SalesOrder) => Promise.resolve(order)),
    };
    command = new CreateSalesOrderCommand(mockRepo as any);
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
