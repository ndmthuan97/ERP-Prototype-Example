/**
 * Suite 04 — Customer
 *
 * Tests customer CRUD, credit check (within/exceeds limit), and soft delete.
 * Uses unique data per run to avoid 409 conflicts.
 */
import * as api from '../helpers/api';
import { seedTestData } from '../helpers/seed';

describe('04 — Customer', () => {
  let customerId: string;
  const runId = Date.now().toString().slice(-8);

  beforeAll(async () => {
    await seedTestData();
  });

  it('should create a customer with credit limit', async () => {
    const res = await api.post('/customers', {
      businessName: `E2E Customer Suite ${runId}`,
      taxCode: `04${runId}`,
      contactName: 'Suite Tester',
      contactPhone: '0912345678',
      contactEmail: `suite-${runId}@customer.com`,
      creditLimitAmount: 5_000_000,
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.businessName).toBe(`E2E Customer Suite ${runId}`);
    customerId = res.data.id;
  });

  it('should get customer by ID', async () => {
    expect(customerId).toBeDefined();
    const res = await api.get(`/customers/${customerId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(customerId);
  });

  it('should search customers with query + pagination', async () => {
    const res = await api.get('/customers?q=E2E&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('should update customer fields', async () => {
    expect(customerId).toBeDefined();
    const res = await api.patch(`/customers/${customerId}`, {
      contactName: 'Updated Tester Name',
      contactPhone: '0900000000',
    });
    expect(res.status).toBe(200);
    expect(res.data.contactName).toBe('Updated Tester Name');
  });

  it('should pass credit check when within limit', async () => {
    expect(customerId).toBeDefined();
    const res = await api.get(
      `/customers/${customerId}/credit-check?orderAmount=1000000&pendingOrdersTotal=0`,
    );
    expect(res.status).toBe(200);
    expect(res.data.canOrder).toBe(true);
  });

  it('should fail credit check when exceeds limit', async () => {
    expect(customerId).toBeDefined();
    const res = await api.get(
      `/customers/${customerId}/credit-check?orderAmount=6000000&pendingOrdersTotal=0`,
    );
    expect(res.status).toBe(200);
    expect(res.data.canOrder).toBe(false);
  });

  it('should soft delete a customer', async () => {
    expect(customerId).toBeDefined();
    const res = await api.del(`/customers/${customerId}`);
    expect(res.status).toBe(204);

    const getRes = await api.get(`/customers/${customerId}`);
    if (getRes.status === 200) {
      expect(getRes.data.status).toBe('archived');
    } else {
      expect(getRes.status).toBe(404);
    }
  });
});
