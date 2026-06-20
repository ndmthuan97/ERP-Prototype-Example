// =============================================================================
// UNIT TEST — UpdateCustomerCommand (Application layer)
// =============================================================================
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateCustomerCommand } from './update-customer.command';
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
    id: '11111111-1111-4111-8111-111111111111',
    businessName: 'WeCare Corp',
    taxCode: '0312345678',
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

describe('UpdateCustomerCommand', () => {
  it('cập nhật thành công + invalidate cache detail', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    const existing = makeCustomer();
    repo.findById.mockResolvedValue(existing);
    repo.save.mockImplementation(async (c: Customer) => c);

    const command = new UpdateCustomerCommand(repo, cache as any);
    const result = await command.execute({
      id: existing.id,
      businessName: 'WeCare Updated',
    });

    expect(result.businessName).toBe('WeCare Updated');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(cache.del).toHaveBeenCalledWith(`customer:${existing.id}`);
  });

  it('ném NotFoundException khi không tồn tại', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    repo.findById.mockResolvedValue(null);

    const command = new UpdateCustomerCommand(repo, cache as any);
    await expect(
      command.execute({
        id: '11111111-1111-4111-8111-111111111111',
        businessName: 'X Corp',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('ném ConflictException khi MST mới đã thuộc KH khác', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    const existing = makeCustomer();
    repo.findById.mockResolvedValue(existing);
    // MST mới đã thuộc 1 KH khác
    repo.findByTaxCode.mockResolvedValue(
      new Customer({ ...existing, id: 'other-id' }),
    );

    const command = new UpdateCustomerCommand(repo, cache as any);
    await expect(
      command.execute({ id: existing.id, taxCode: '0398765432' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
