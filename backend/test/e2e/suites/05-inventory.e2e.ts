/**
 * Suite 05 — Inventory
 *
 * Tests stock item CRUD, receive/reserve/release/issue operations,
 * availability check, and error cases.
 *
 * Aligned with actual API behavior:
 * - POST endpoints return 201 (NestJS default for POST)
 * - availability returns { available: number, canReserve: boolean }
 * - reserve/release require { orderId: UUID, quantity: number }
 */
import * as api from '../helpers/api';
import { seedTestData } from '../helpers/seed';
import { randomUUID } from 'crypto';

describe('05 — Inventory', () => {
  const uniqueSku = `E2E-INV-${Date.now()}`;
  let itemSku: string;

  beforeAll(async () => {
    await seedTestData();
    itemSku = uniqueSku;
  });

  it('should create a stock item', async () => {
    const res = await api.post('/inventory/items', {
      sku: itemSku,
      name: 'E2E Inventory Test Item',
    });
    expect(res.status).toBe(201);
    expect(res.data.sku).toBe(itemSku);
  });

  it('should get item by SKU', async () => {
    const res = await api.get(`/inventory/items/${itemSku}`);
    expect(res.status).toBe(200);
    expect(res.data.sku).toBe(itemSku);
  });

  it('should search items with pagination', async () => {
    const res = await api.get('/inventory/items?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('should receive stock (qty: 50)', async () => {
    const res = await api.post(`/inventory/items/${itemSku}/receive`, {
      quantity: 50,
    });
    // POST returns 201 by default in NestJS
    expect([200, 201]).toContain(res.status);
    // Response wraps domain entity
    const qty = res.data.quantityAvailable ?? res.data.item?.quantityAvailable;
    expect(qty).toBe(50);
  });

  it('should reserve stock (qty: 10)', async () => {
    const orderId = randomUUID();
    const res = await api.post(`/inventory/items/${itemSku}/reserve`, {
      orderId,
      quantity: 10,
    });
    expect([200, 201]).toContain(res.status);
    // ReserveResult = { item, reservationId }
    const item = res.data.item ?? res.data;
    expect(item.quantityAvailable).toBe(40);
    expect(item.quantityReserved).toBe(10);
  });

  it('should release stock (qty: 10)', async () => {
    const orderId = randomUUID();
    // First reserve so there's something to release
    await api.post(`/inventory/items/${itemSku}/reserve`, {
      orderId,
      quantity: 10,
    });

    const res = await api.post(`/inventory/items/${itemSku}/release`, {
      orderId,
      quantity: 10,
    });
    expect([200, 201]).toContain(res.status);
  });

  it('should reserve and issue stock (qty: 5)', async () => {
    const orderId = randomUUID();
    await api.post(`/inventory/items/${itemSku}/reserve`, {
      orderId,
      quantity: 5,
    });

    const res = await api.post(`/inventory/items/${itemSku}/issue`, {
      quantity: 5,
      reason: 'e2e_test_issue',
    });
    expect([200, 201]).toContain(res.status);
  });

  it('should reject reserve when exceeds available quantity', async () => {
    const orderId = randomUUID();
    const res = await api.post(`/inventory/items/${itemSku}/reserve`, {
      orderId,
      quantity: 9999,
    });
    expect([400, 409]).toContain(res.status);
  });

  it('should check availability — sufficient', async () => {
    const res = await api.get(`/inventory/items/${itemSku}/availability?quantity=5`);
    expect(res.status).toBe(200);
    // API returns { sku, available: number, reserved: number, total: number, canReserve: boolean }
    expect(res.data.canReserve).toBe(true);
  });

  it('should check availability — insufficient', async () => {
    const res = await api.get(`/inventory/items/${itemSku}/availability?quantity=9999`);
    expect(res.status).toBe(200);
    expect(res.data.canReserve).toBe(false);
  });
});
