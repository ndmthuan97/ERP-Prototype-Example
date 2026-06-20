// =============================================================================
// UNIT TEST — SearchCustomersQuery (clamp page/limit, delegate repo)
// =============================================================================
import { SearchCustomersQuery } from './search-customers.query';
import type { ICustomerRepository } from '../../domain/repositories/customer.repository';

function makeRepoMock(): jest.Mocked<ICustomerRepository> {
  return {
    findById: jest.fn(),
    findByTaxCode: jest.fn(),
    search: jest
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('SearchCustomersQuery', () => {
  it('dùng default page=1, limit=20 khi không truyền', async () => {
    const repo = makeRepoMock();
    const query = new SearchCustomersQuery(repo);
    await query.execute();
    expect(repo.search).toHaveBeenCalledWith('', 1, 20);
  });

  it('clamp limit > 100 về 100 và page < 1 về 1', async () => {
    const repo = makeRepoMock();
    const query = new SearchCustomersQuery(repo);
    await query.execute('acme', 0, 500);
    expect(repo.search).toHaveBeenCalledWith('acme', 1, 100);
  });

  it('trim query trước khi delegate', async () => {
    const repo = makeRepoMock();
    const query = new SearchCustomersQuery(repo);
    await query.execute('  acme  ', 2, 50);
    expect(repo.search).toHaveBeenCalledWith('acme', 2, 50);
  });
});
