// =============================================================================
// UNIT TEST — CheckCreditQuery (credit check cho Order Service)
// =============================================================================
import { NotFoundException } from '@nestjs/common';
import { CheckCreditQuery } from './check-credit.query';
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

const ID = '44444444-4444-4444-4444-444444444444';

function makeCustomer(
  overrides: Partial<ConstructorParameters<typeof Customer>[0]> = {},
) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new Customer({
    id: ID,
    businessName: 'WeCare Corp',
    taxCode: null,
    status: 'active',
    creditLimitAmount: 10_000_000,
    creditUsedAmount: 3_000_000,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

describe('CheckCreditQuery', () => {
  it('trả thông tin tín dụng + canOrder=true khi active (no pending)', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeCustomer());

    const query = new CheckCreditQuery(repo);
    const result = await query.execute(ID);

    expect(result).toEqual({
      customerId: ID,
      creditLimit: 10_000_000,
      creditUsed: 3_000_000,
      pendingAmount: 0,
      available: 7_000_000,
      canOrder: true,
    });
  });

  it('should deduct pendingOrdersTotal from available credit', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeCustomer());

    const query = new CheckCreditQuery(repo);
    const result = await query.execute(ID, 1_000_000, 2_000_000);

    expect(result.pendingAmount).toBe(2_000_000);
    expect(result.available).toBe(5_000_000); // 7M - 2M pending
  });

  it('should clamp available to 0 when pending exceeds raw available', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeCustomer());

    const query = new CheckCreditQuery(repo);
    const result = await query.execute(ID, 0, 10_000_000);

    expect(result.available).toBe(0);
  });

  it('canOrder=false khi suspended', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(makeCustomer({ status: 'suspended' }));

    const query = new CheckCreditQuery(repo);
    const result = await query.execute(ID);
    expect(result.canOrder).toBe(false);
  });

  it('không tìm thấy → NotFoundException', async () => {
    const repo = makeRepoMock();
    repo.findById.mockResolvedValue(null);

    const query = new CheckCreditQuery(repo);
    await expect(query.execute(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
