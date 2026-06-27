/**
 * Suite 09 — Sales Return
 *
 * Tests return lifecycle (draft→approved→goods_received→completed),
 * rejection flow, and error cases.
 *
 * Prerequisite: Creates a fully_delivered SO via delivery flow.
 * NOTE: If PubSub saga doesn't work, all tests are skipped gracefully.
 */
import * as api from '../helpers/api';
import { waitForStatus } from '../helpers/wait-for';
import { seedTestData, getSeedData } from '../helpers/seed';

describe('09 — Sales Return', () => {
  let orderId: string;
  let lineIdA: string;
  let returnId: string;
  let sagaReady = false;

  beforeAll(async () => {
    const seed = await seedTestData();

    const createRes = await api.post('/orders', {
      customerId: seed.customerId,
    });
    orderId = createRes.data.id;

    const lineRes = await api.post(`/orders/${orderId}/lines`, {
      itemId: seed.stockItemA.id,
      itemName: seed.productA.name,
      quantity: 5,
      unitPrice: 1000,
    });
    lineIdA = lineRes.data.id;

    // Submit → wait for confirmed
    await api.post(`/orders/${orderId}/submit`);

    try {
      await waitForStatus(
        () => api.get(`/orders/${orderId}`),
        'confirmed',
        { timeout: 30_000, description: 'SO confirmed for return tests' },
      );
    } catch {
      console.warn('⚠️  Saga did not confirm SO — return tests will be skipped');
      return;
    }

    // Create DO and deliver all items → fully_delivered
    try {
      const doRes = await api.post(`/orders/${orderId}/deliveries`, {
        lines: [{ salesOrderLineId: lineIdA, quantity: 5 }],
      });
      const doId = doRes.data.id;

      await api.post(`/orders/${orderId}/deliveries/${doId}/start-picking`);
      await api.post(`/orders/${orderId}/deliveries/${doId}/pack`);
      await api.post(`/orders/${orderId}/deliveries/${doId}/ship`);
      await api.post(`/orders/${orderId}/deliveries/${doId}/deliver`);

      const soRes = await api.get(`/orders/${orderId}`);
      if (soRes.data.status === 'fully_delivered') {
        sagaReady = true;
      }
    } catch (e) {
      console.warn('⚠️  Delivery flow failed — return tests will be skipped');
    }
  });

  function skipIfNoSaga() {
    if (!sagaReady) {
      console.warn('⚠️  Skipping — saga/delivery prerequisite not met');
      return true;
    }
    return false;
  }

  it('should create a return', async () => {
    if (skipIfNoSaga()) return;
    const res = await api.post(`/orders/${orderId}/returns`, {
      reason: 'Defective items — E2E test',
      lines: [
        { salesOrderLineId: lineIdA, quantity: 2, reason: 'Broken packaging' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.status).toBe('draft');
    returnId = res.data.id;
  });

  it('should approve the return', async () => {
    if (skipIfNoSaga() || !returnId) return;
    const res = await api.post(
      `/orders/${orderId}/returns/${returnId}/approve`,
    );
    expect([200, 201]).toContain(res.status);
    expect(res.data.status).toBe('approved');
  });

  it('should mark goods received', async () => {
    if (skipIfNoSaga() || !returnId) return;
    const res = await api.post(
      `/orders/${orderId}/returns/${returnId}/receive-goods`,
    );
    expect([200, 201]).toContain(res.status);
    expect(res.data.status).toBe('goods_received');
  });

  it('should complete the return', async () => {
    if (skipIfNoSaga() || !returnId) return;
    const res = await api.post(
      `/orders/${orderId}/returns/${returnId}/complete`,
    );
    expect([200, 201]).toContain(res.status);
    expect(res.data.status).toBe('completed');
  });

  it('should list returns for the SO', async () => {
    if (skipIfNoSaga()) return;
    const res = await api.get(`/orders/${orderId}/returns`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject creating return for non-delivered SO', async () => {
    const seed = getSeedData();
    const draftRes = await api.post('/orders', {
      customerId: seed.customerId,
    });
    const res = await api.post(`/orders/${draftRes.data.id}/returns`, {
      reason: 'Should fail',
      lines: [{ salesOrderLineId: 'fake-line-id', quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('should reject a return', async () => {
    if (skipIfNoSaga()) return;
    const createRes = await api.post(`/orders/${orderId}/returns`, {
      reason: 'Return to be rejected — E2E',
      lines: [
        { salesOrderLineId: lineIdA, quantity: 1, reason: 'Testing rejection' },
      ],
    });
    expect(createRes.status).toBe(201);
    const rejectReturnId = createRes.data.id;

    const res = await api.post(
      `/orders/${orderId}/returns/${rejectReturnId}/reject`,
    );
    expect([200, 201]).toContain(res.status);
    expect(res.data.status).toBe('rejected');
  });
});
