// Tests cho GetItemQuery + SearchItemsQuery + CheckAvailabilityQuery
import { NotFoundException } from '@nestjs/common';
import { GetItemQuery } from './get-item.query';
import { SearchItemsQuery } from './search-items.query';
import { CheckAvailabilityQuery } from './check-availability.query';
import { StockItem } from '../../domain/entities/stock-item.entity';
import type { IStockItemRepository } from '../../domain/repositories/stock-item.repository';

function makeRepoMock(): jest.Mocked<IStockItemRepository> {
  return {
    findById: jest.fn(),
    findBySku: jest.fn(),
    search: jest
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    create: jest.fn(),
    updateWithLock: jest.fn(),
    createOutboxEvent: jest.fn(),
  };
}

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

describe('GetItemQuery', () => {
  it('trả item khi tồn tại', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(10));
    const q = new GetItemQuery(repo);
    expect((await q.execute('SKU-001')).sku).toBe('SKU-001');
  });

  it('NotFoundException khi không có', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(null);
    const q = new GetItemQuery(repo);
    await expect(q.execute('SKU-X')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SearchItemsQuery', () => {
  it('default page=1 limit=20, trim query', async () => {
    const repo = makeRepoMock();
    const q = new SearchItemsQuery(repo);
    await q.execute('  widget  ');
    expect(repo.search).toHaveBeenCalledWith('widget', 1, 20);
  });

  it('clamp limit > 100 → 100, page < 1 → 1', async () => {
    const repo = makeRepoMock();
    const q = new SearchItemsQuery(repo);
    await q.execute('', 0, 999);
    expect(repo.search).toHaveBeenCalledWith('', 1, 100);
  });
});

describe('CheckAvailabilityQuery', () => {
  it('trả available/reserved/total + canReserve', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(70, 30));
    const q = new CheckAvailabilityQuery(repo);
    const r = await q.execute('SKU-001', 50);
    expect(r).toEqual({
      sku: 'SKU-001',
      available: 70,
      reserved: 30,
      total: 100,
      canReserve: true,
    });
  });

  it('canReserve=false khi vượt available', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(makeItem(5));
    const q = new CheckAvailabilityQuery(repo);
    expect((await q.execute('SKU-001', 10)).canReserve).toBe(false);
  });

  it('NotFoundException khi không có', async () => {
    const repo = makeRepoMock();
    repo.findBySku.mockResolvedValue(null);
    const q = new CheckAvailabilityQuery(repo);
    await expect(q.execute('SKU-X')).rejects.toBeInstanceOf(NotFoundException);
  });
});
