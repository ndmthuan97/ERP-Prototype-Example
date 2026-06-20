// =============================================================================
// UNIT TEST — DeleteCustomerCommand (Application layer)
// =============================================================================
import { NotFoundException } from '@nestjs/common';
import { DeleteCustomerCommand } from './delete-customer.command';
import { Customer } from '../../domain/entities/customer.entity';
import type { ICustomerRepository } from '../../domain/repositories/customer.repository';

function makeRepoMock(): jest.Mocked<ICustomerRepository> {
  return {
    findById: jest.fn(),
    findByTaxCode: jest.fn(),
    search: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

function makeCacheMock() {
  return { del: jest.fn().mockResolvedValue(undefined) };
}

function makeCustomer(): Customer {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new Customer({
    id: '22222222-2222-2222-2222-222222222222',
    businessName: 'WeCare Corp',
    taxCode: null,
    status: 'active',
    creditLimitAmount: null,
    creditUsedAmount: 0,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('DeleteCustomerCommand', () => {
  it('archive entity + gọi repo.delete + invalidate cache', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    const existing = makeCustomer();
    repo.findById.mockResolvedValue(existing);

    const command = new DeleteCustomerCommand(repo, cache as any);
    await command.execute(existing.id);

    // archive() đã chạy → status archived + deletedAt set
    expect(existing.status).toBe('archived');
    expect(existing.deletedAt).toBeInstanceOf(Date);
    expect(repo.delete).toHaveBeenCalledWith(existing);
    expect(cache.del).toHaveBeenCalledWith(`customer:${existing.id}`);
  });

  it('ném NotFoundException khi không tồn tại', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    repo.findById.mockResolvedValue(null);

    const command = new DeleteCustomerCommand(repo, cache as any);
    await expect(
      command.execute('22222222-2222-2222-2222-222222222222'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
