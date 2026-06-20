// =============================================================================
// INTEGRATION TEST — Inventory trên DB thật: OPTIMISTIC LOCKING dưới đồng thời
// =============================================================================
// Kiểm chứng: 5 lệnh reserve ĐỒNG THỜI trên cùng 1 mặt hàng KHÔNG mất update
// (nhờ optimistic lock + retry). Nếu không có lock, concurrent update sẽ ghi đè
// lẫn nhau → tổng reserved sai.
//
// CẦN DATABASE_URL. Không có → tự SKIP. Dọn dữ liệu test ở afterAll.

import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PrismaStockItemRepository } from '../src/infrastructure/persistence/stock-item.repository.impl';
import { StockItem } from '../src/domain/entities/stock-item.entity';
import { ReserveStockCommand } from '../src/application/commands/reserve-stock.command';

const hasDb = Boolean(
  process.env.DATABASE_URL || process.env.RUNTIME_DATABASE_URL,
);
const describeWithDb = hasDb ? describe : describe.skip;

function uniqueSku(): string {
  return 'INT-' + Math.floor(Math.random() * 1e8).toString();
}

describeWithDb('Inventory optimistic locking (integration)', () => {
  let prisma: PrismaService;
  let repo: PrismaStockItemRepository;
  let reserve: ReserveStockCommand;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repo = new PrismaStockItemRepository(prisma);
    reserve = new ReserveStockCommand(repo);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.outbox.deleteMany({
        where: { aggregateId: { in: createdIds } },
      });
      await prisma.stockItem.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.onModuleDestroy();
  });

  async function seedItem(available: number): Promise<StockItem> {
    const now = new Date();
    const item = new StockItem({
      id: randomUUID(),
      sku: uniqueSku(),
      name: 'INT Widget',
      quantityAvailable: available,
      quantityReserved: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const created = await repo.create(item);
    createdIds.push(created.id);
    return created;
  }

  it('5 reserve ĐỒNG THỜI không mất update (optimistic lock + retry)', async () => {
    const item = await seedItem(100);

    // 5 lệnh reserve(10) chạy song song trên cùng SKU
    await Promise.all(
      Array.from({ length: 5 }, () =>
        reserve.execute(item.sku, { orderId: randomUUID(), quantity: 10 }),
      ),
    );

    const after = await repo.findBySku(item.sku);
    // Không mất update: reserved = 50, available = 50 (tổng vẫn 100)
    expect(after?.quantityReserved).toBe(50);
    expect(after?.quantityAvailable).toBe(50);
  });

  it('reserve vượt tồn → ConflictException', async () => {
    const item = await seedItem(5);
    await expect(
      reserve.execute(item.sku, { orderId: randomUUID(), quantity: 10 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('trùng SKU → ConflictException (P2002)', async () => {
    const item = await seedItem(10);
    const dup = new StockItem({
      id: randomUUID(),
      sku: item.sku, // trùng
      name: 'dup',
      quantityAvailable: 0,
      quantityReserved: 0,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdIds.push(dup.id);
    await expect(repo.create(dup)).rejects.toBeInstanceOf(ConflictException);
  });
});
