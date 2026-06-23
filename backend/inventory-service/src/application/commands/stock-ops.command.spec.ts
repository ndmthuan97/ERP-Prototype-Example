// Tests cho ReceiveStockCommand + ReleaseStockCommand
import { NotFoundException } from '@nestjs/common';
import { ReceiveStockCommand } from './receive-stock.command';
import { ReleaseStockCommand } from './release-stock.command';
import { StockItem } from '../../domain/entities/stock-item.entity';
import type { IStockItemRepository } from '../../domain/repositories/stock-item.repository';

function makeRepoMock(): jest.Mocked<IStockItemRepository> {
  return {
    findById: jest.fn(),
    findBySku: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    updateWithLock: jest.fn(),
    createOutboxEvent: jest.fn(),
  };
}

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function makeItem(available: number, reserved = 0): StockItem {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new StockItem({
    id: 'item-1',
    sku: 'SKU-001',
    name: 'Widget',
    quantityAvailable: available,
    quantityReserved: reserved,
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
}

describe('ReceiveStockCommand', () => {
  it('nhập kho tăng available + updateWithLock', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(10));
    repo.updateWithLock.mockImplementation(async (item) => item);

    const command = new ReceiveStockCommand(repo);
    const result = await command.execute('SKU-001', { quantity: 5 });

    expect(result.quantityAvailable).toBe(15);
    expect(repo.updateWithLock).toHaveBeenCalledTimes(1);
  });

  it('SKU không tồn tại → NotFoundException', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(null);
    const command = new ReceiveStockCommand(repo);
    await expect(
      command.execute('SKU-X', { quantity: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReleaseStockCommand', () => {
  it('nhả giữ chỗ + event inventory.released', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(70, 30));
    repo.updateWithLock.mockImplementation(async (item) => item);

    const command = new ReleaseStockCommand(repo);
    const result = await command.execute('SKU-001', {
      orderId: ORDER_ID,
      quantity: 20,
    });

    expect(result.item.quantityReserved).toBe(10);
    expect(result.item.quantityAvailable).toBe(90);
    const eventArg = repo.updateWithLock.mock.calls[0][1];
    expect(eventArg?.eventType).toBe('inventory.released');
  });

  it('SKU không tồn tại → NotFoundException', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(null);
    const command = new ReleaseStockCommand(repo);
    await expect(
      command.execute('SKU-X', { orderId: ORDER_ID, quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
