import { CreateItemCommand } from './create-item.command';
import { StockItem } from '../../domain/entities/stock-item.entity';
import type { IStockItemRepository } from '../../domain/repositories/stock-item.repository';

function makeRepoMock(): jest.Mocked<IStockItemRepository> {
  return {
    findById: jest.fn(),
    findBySku: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    updateWithLock: jest.fn(),
    saveWithMovement: jest.fn(),
    createOutboxEvent: jest.fn(),
  };
}

describe('CreateItemCommand', () => {
  it('tạo item với initialQuantity', async () => {
    const repo = makeRepoMock();
    repo.create.mockImplementation(async (item: StockItem) => item);

    const command = new CreateItemCommand(repo);
    const result = await command.execute({
      sku: 'SKU-001',
      name: 'Widget',
      initialQuantity: 25,
    });

    expect(result.sku).toBe('SKU-001');
    expect(result.quantityAvailable).toBe(25);
    expect(result.quantityReserved).toBe(0);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('mặc định quantity = 0 khi không truyền', async () => {
    const repo = makeRepoMock();
    repo.create.mockImplementation(async (item: StockItem) => item);

    const command = new CreateItemCommand(repo);
    const result = await command.execute({ sku: 'SKU-002', name: 'Gadget' });
    expect(result.quantityAvailable).toBe(0);
  });

  it('SKU quá ngắn → ZodError', async () => {
    const repo = makeRepoMock();
    const command = new CreateItemCommand(repo);
    await expect(
      command.execute({ sku: 'X', name: 'Widget' }),
    ).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
