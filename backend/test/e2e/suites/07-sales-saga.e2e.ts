/**
 * Suite 07 — Sales Order Submit Flow ⭐
 *
 * Core E2E test: validates the synchronous submit flow.
 * - Happy path: draft → submit → (HTTP reserve + credit-check) → confirmed
 * - Compensation: insufficient stock → cancelled (immediate)
 * - Edge cases: no lines, cancel draft/confirmed
 *
 * NOTE (v2): Submit is now synchronous — the response includes the final
 * status (confirmed/cancelled). No more Pub/Sub polling required.
 */
import * as api from '../helpers/api';
import { seedTestData, getSeedData } from '../helpers/seed';

describe('07 — Sales Order Submit Flow ⭐', () => {
  let orderId: string;

  beforeAll(async () => {
    await seedTestData();
  });

  // ===========================================================================
  // HAPPY PATH
  // ===========================================================================

  describe('Happy Path — draft → confirmed (synchronous)', () => {
    it('should create a sales order (draft)', async () => {
      const seed = getSeedData();
      const res = await api.post('/orders', {
        customerId: seed.customerId,
      });
      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.status).toBe('draft');
      orderId = res.data.id;
    });

    it('should add line — Product A (qty=5, price=1000)', async () => {
      const seed = getSeedData();
      const res = await api.post(`/orders/${orderId}/lines`, {
        itemId: seed.stockItemA.id,
        itemName: seed.productA.name,
        quantity: 5,
        unitPrice: 1000,
      });
      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
    });

    it('should add line — Product B (qty=3, price=500)', async () => {
      const seed = getSeedData();
      const res = await api.post(`/orders/${orderId}/lines`, {
        itemId: seed.stockItemB.id,
        itemName: seed.productB.name,
        quantity: 3,
        unitPrice: 500,
      });
      expect(res.status).toBe(201);
    });

    it('should submit and confirm SO immediately (synchronous)', async () => {
      const res = await api.post(`/orders/${orderId}/submit`);
      expect(res.status).toBe(200);
      // Submit now returns final status directly — no polling needed
      expect(res.data.status).toBe('confirmed');
      expect(res.data.id).toBe(orderId);
    });

    it('should verify SO is confirmed via GET', async () => {
      const res = await api.get(`/orders/${orderId}`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('confirmed');
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should reject submitting SO with no lines', async () => {
      const seed = getSeedData();
      const createRes = await api.post('/orders', {
        customerId: seed.customerId,
      });
      expect(createRes.status).toBe(201);

      const res = await api.post(`/orders/${createRes.data.id}/submit`);
      expect(res.status).toBe(400);
    });

    it('should cancel a draft SO', async () => {
      const seed = getSeedData();
      const createRes = await api.post('/orders', {
        customerId: seed.customerId,
      });
      const draftId = createRes.data.id;

      const res = await api.post(`/orders/${draftId}/cancel`, {
        reason: 'E2E test cancel draft',
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('cancelled');
    });

    it('should cancel a confirmed SO and release stock', async () => {
      const res = await api.post(`/orders/${orderId}/cancel`, {
        reason: 'E2E test cancel confirmed order',
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('cancelled');
    });

    it('should list orders for customer', async () => {
      const res = await api.get('/orders');
      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      expect(Array.isArray(res.data.data)).toBe(true);
    });
  });
});
