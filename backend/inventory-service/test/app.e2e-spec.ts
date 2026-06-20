// =============================================================================
// E2E TEST — Inventory Service (guarded by DATABASE_URL)
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const hasInfra = Boolean(
  process.env.DATABASE_URL || process.env.RUNTIME_DATABASE_URL,
);
const describeWithInfra = hasInfra ? describe : describe.skip;

function uniqueSku(): string {
  return 'E2E-' + Math.floor(Math.random() * 1e8).toString();
}

describeWithInfra('Inventory Service (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const sku = uniqueSku();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health → 200 ok', async () => {
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ok');
  });

  it('POST item → 201, reserve → availability', async () => {
    const created = await request(server)
      .post('/inventory/items')
      .send({ sku, name: 'E2E Widget', initialQuantity: 50 });
    expect(created.status).toBe(201);

    const reserve = await request(server)
      .post(`/inventory/items/${sku}/reserve`)
      .send({ orderId: randomUUID(), quantity: 20 });
    expect(reserve.status).toBe(201);
    expect(
      (reserve.body as { reservationId: string }).reservationId,
    ).toBeDefined();

    const avail = await request(server).get(
      `/inventory/items/${sku}/availability`,
    );
    const body = avail.body as { available: number; reserved: number };
    expect(body.available).toBe(30);
    expect(body.reserved).toBe(20);
  });

  it('reserve vượt tồn → 409', async () => {
    const res = await request(server)
      .post(`/inventory/items/${sku}/reserve`)
      .send({ orderId: randomUUID(), quantity: 9999 });
    expect(res.status).toBe(409);
  });

  it('SKU không tồn tại → 404', async () => {
    const res = await request(server).get('/inventory/items/NOPE-404');
    expect(res.status).toBe(404);
  });
});
