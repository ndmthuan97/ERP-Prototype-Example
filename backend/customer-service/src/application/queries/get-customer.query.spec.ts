// =============================================================================
// UNIT TEST — GetCustomerQuery (Application layer, Cache-Aside)
// =============================================================================
import { NotFoundException } from '@nestjs/common';
import { GetCustomerQuery } from './get-customer.query';
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
  return {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

const ID = '33333333-3333-3333-3333-333333333333';

function makeCustomer(): Customer {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new Customer({
    id: ID,
    businessName: 'WeCare Corp',
    taxCode: null,
    status: 'active',
    creditLimitAmount: 5_000_000,
    creditUsedAmount: 1_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('GetCustomerQuery', () => {
  it('cache HIT → trả entity, KHÔNG gọi repo', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    cache.get.mockResolvedValue({
      id: ID,
      businessName: 'Cached Co',
      taxCode: null,
      status: 'active',
      creditLimitAmount: 5_000_000,
      creditUsedAmount: 0,
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    });

    const query = new GetCustomerQuery(repo, cache as any);
    const result = await query.execute(ID);

    expect(result.businessName).toBe('Cached Co');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('cache MISS → đọc DB → ghi cache', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    cache.get.mockResolvedValue(null);
    repo.findById.mockResolvedValue(makeCustomer());

    const query = new GetCustomerQuery(repo, cache as any);
    const result = await query.execute(ID);

    expect(result.id).toBe(ID);
    expect(repo.findById).toHaveBeenCalledWith(ID);
    expect(cache.set).toHaveBeenCalledWith(
      `customer:${ID}`,
      expect.any(Object),
    );
  });

  it('không tìm thấy → NotFoundException', async () => {
    const repo = makeRepoMock();
    const cache = makeCacheMock();
    cache.get.mockResolvedValue(null);
    repo.findById.mockResolvedValue(null);

    const query = new GetCustomerQuery(repo, cache as any);
    await expect(query.execute(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
