// =============================================================================
// UNIT TEST — ReserveStockCommand (optimistic retry + insufficient stock)
// =============================================================================
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReserveStockCommand } from './reserve-stock.command';
import { StockItem } from '../../domain/entities/stock-item.entity';
import {
  OptimisticLockError,
  type IStockItemRepository,
} from '../../domain/repositories/stock-item.repository';

function makeRepoMock(): jest.Mocked<IStockItemRepository> {
  return {
    findById: jest.fn(),
    findBySku: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    updateWithLock: jest.fn(),
  };
}

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function makeItem(available: number): StockItem {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new StockItem({
    id: 'item-1',
    sku: 'SKU-001',
    name: 'Widget',
    quantityAvailable: available,
    quantityReserved: 0,
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
}

describe('ReserveStockCommand', () => {
  it('reserve thành công → updateWithLock kèm event inventory.reserved', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(100));
    repo.updateWithLock.mockImplementation(async (item) => item);

    const command = new ReserveStockCommand(repo);
    const result = await command.execute('SKU-001', {
      orderId: ORDER_ID,
      quantity: 10,
    });

    expect(result.reservationId).toBeDefined();
    expect(repo.updateWithLock).toHaveBeenCalledTimes(1);
    const eventArg = repo.updateWithLock.mock.calls[0][1];
    expect(eventArg?.eventType).toBe('inventory.reserved');
    expect(eventArg?.payload).toMatchObject({ orderId: ORDER_ID });
  });

  it('không đủ tồn → ConflictException', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(3));

    const command = new ReserveStockCommand(repo);
    await expect(
      command.execute('SKU-001', { orderId: ORDER_ID, quantity: 10 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateWithLock).not.toHaveBeenCalled();
  });

  it('SKU không tồn tại → NotFoundException', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(null);

    const command = new ReserveStockCommand(repo);
    await expect(
      command.execute('SKU-X', { orderId: ORDER_ID, quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('OptimisticLockError → retry (reload + thử lại) rồi thành công', async () => {
    const repo = makeRepoMock();
    // Mỗi lần retry reload entity tươi
    repo.findBySku.mockImplementation(async () => makeItem(100));
    repo.updateWithLock
      .mockRejectedValueOnce(new OptimisticLockError('item-1'))
      .mockImplementation(async (item) => item);

    const command = new ReserveStockCommand(repo);
    const result = await command.execute('SKU-001', {
      orderId: ORDER_ID,
      quantity: 10,
    });

    expect(result.reservationId).toBeDefined();
    // findBySku gọi 2 lần (lần đầu + lần retry), updateWithLock 2 lần
    expect(repo.findBySku).toHaveBeenCalledTimes(2);
    expect(repo.updateWithLock).toHaveBeenCalledTimes(2);
  });
});
