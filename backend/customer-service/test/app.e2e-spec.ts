// =============================================================================
// E2E TEST — Customer Service
// =============================================================================
// Test thật qua HTTP: boot AppModule rồi gọi /health và /customers.
//
// CẦN HẠ TẦNG THẬT: Postgres (DATABASE_URL/DIRECT_URL) + Upstash Redis
// (UPSTASH_REDIS_REST_URL/TOKEN). Khi các biến này CHƯA set (vd CI không có
// infra), cả suite tự SKIP để pipeline không đỏ oan — thay vì test rác cũ
// (`GET /` → "Hello World!") vốn luôn fail vì route đó không tồn tại.
//
// Chạy local:
//   cd backend/customer-service && npm run test:e2e

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/** Shape tối thiểu của customer response — cast body (any) về đây cho type-safe. */
interface CustomerResponse {
  id: string;
  businessName: string;
  status: string;
}

/** Chỉ chạy khi có connection string DB — nếu không thì skip toàn bộ. */
const hasInfra = Boolean(
  process.env.DATABASE_URL || process.env.RUNTIME_DATABASE_URL,
);
const describeWithInfra = hasInfra ? describe : describe.skip;

describeWithInfra('Customer Service (e2e)', () => {
  let app: INestApplication;
  let server: Server;

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

  it('GET /health → 200, status ok', async () => {
    const res = await request(server).get('/health');
    const body = res.body as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('POST /customers → 201, sau đó GET /customers/:id → 200', async () => {
    const created = await request(server)
      .post('/customers')
      .send({ businessName: 'E2E Test Co' });
    const createdBody = created.body as CustomerResponse;

    expect(created.status).toBe(201);
    expect(createdBody.businessName).toBe('E2E Test Co');
    expect(createdBody.status).toBe('active');

    const fetched = await request(server).get(`/customers/${createdBody.id}`);
    const fetchedBody = fetched.body as CustomerResponse;

    expect(fetched.status).toBe(200);
    expect(fetchedBody.id).toBe(createdBody.id);
  });

  it('POST /customers với businessName quá ngắn → 400', async () => {
    const res = await request(server)
      .post('/customers')
      .send({ businessName: 'X' });

    expect(res.status).toBe(400);
  });

  it('GET /customers/:id không tồn tại → 404', async () => {
    const res = await request(server).get(
      '/customers/00000000-0000-0000-0000-000000000000',
    );

    expect(res.status).toBe(404);
  });
});
