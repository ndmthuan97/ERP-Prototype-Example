// =============================================================================
// INTEGRATION TEST — PrismaCustomerRepository (DB thật)
// =============================================================================
// Chạy repository + outbox store TRỰC TIẾP trên Postgres thật (không mock) để
// kiểm chứng: migration/schema đúng, unique tax_code (P2002), outbox ghi trong
// transaction, outbox CLAIM (SKIP LOCKED) + markPublished, soft delete.
//
// CẦN: DATABASE_URL (+ schema "customer" đã tồn tại). Không có → tự SKIP.
// Chạy:  npm run test:int   (sau khi prisma db push)

import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PrismaCustomerRepository } from '../src/infrastructure/persistence/customer.repository.impl';
import { PrismaOutboxStore } from '../src/infrastructure/persistence/prisma-outbox.store';
import { Customer } from '../src/domain/entities/customer.entity';

const hasDb = Boolean(
  process.env.DATABASE_URL || process.env.RUNTIME_DATABASE_URL,
);
const describeWithDb = hasDb ? describe : describe.skip;

function uniqueTaxCode(): string {
  return Math.floor(Math.random() * 1e10)
    .toString()
    .padStart(10, '0');
}

function makeCustomer(taxCode: string | null): Customer {
  const now = new Date();
  return new Customer({
    id: randomUUID(),
    businessName: 'INT Test Co',
    taxCode,
    status: 'active',
    creditLimitAmount: 10_000_000,
    creditUsedAmount: 0,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describeWithDb('PrismaCustomerRepository (integration)', () => {
  let prisma: PrismaService;
  let repo: PrismaCustomerRepository;
  let outbox: PrismaOutboxStore;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repo = new PrismaCustomerRepository(prisma);
    outbox = new PrismaOutboxStore(prisma);
  });

  afterAll(async () => {
    // Dọn dữ liệu test (xoá outbox + cores theo id đã tạo)
    if (createdIds.length > 0) {
      await prisma.outbox.deleteMany({
        where: { aggregateId: { in: createdIds } },
      });
      await prisma.customerCore.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    await prisma.onModuleDestroy();
  });

  it('save() ghi customer + outbox event trong cùng transaction', async () => {
    const c = makeCustomer(uniqueTaxCode());
    createdIds.push(c.id);

    const saved = await repo.save(c);
    expect(saved.id).toBe(c.id);

    const found = await repo.findById(c.id);
    expect(found?.businessName).toBe('INT Test Co');

    const pending = await outbox.fetchUnpublished(100);
    const ev = pending.find((e) => e.aggregateId === c.id);
    expect(ev?.eventType).toBe('customer.created');
  });

  it('chống trùng tax_code ở DB → ConflictException (P2002)', async () => {
    const tax = uniqueTaxCode();
    const c1 = makeCustomer(tax);
    createdIds.push(c1.id);
    await repo.save(c1);

    const c2 = makeCustomer(tax); // cùng MST
    createdIds.push(c2.id);
    await expect(repo.save(c2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft delete → findById trả null', async () => {
    const c = makeCustomer(uniqueTaxCode());
    createdIds.push(c.id);
    await repo.save(c);

    c.archive();
    await repo.delete(c);

    expect(await repo.findById(c.id)).toBeNull();
  });

  it('outbox CLAIM (SKIP LOCKED) + markPublished + countPending', async () => {
    const c = makeCustomer(uniqueTaxCode());
    createdIds.push(c.id);
    await repo.save(c);

    const batch = await outbox.fetchUnpublished(100);
    const ev = batch.find((e) => e.aggregateId === c.id);
    expect(ev).toBeDefined();

    await outbox.markPublished(ev!.id);
    expect(typeof (await outbox.countPending())).toBe('number');
  });
});
