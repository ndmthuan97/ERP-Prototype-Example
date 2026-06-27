/**
 * Suite 01 — Health Check (Smoke Test)
 *
 * Verifies all services are running and API Gateway proxies correctly.
 * Runs seed once to cache auth token for all subsequent suites.
 */
import * as api from '../helpers/api';
import { seedTestData } from '../helpers/seed';

describe('01 — Health Check', () => {
  // Seed runs FIRST — login once and cache token for all suites
  beforeAll(async () => {
    await seedTestData();
  });

  it('should respond from the gateway', async () => {
    // Gateway intercepts all routes with JWT middleware
    // Any response (even 401) proves the gateway is alive
    const res = await api.raw('GET', '/api/customers');
    expect(res.status).toBeDefined();
    expect(res.status).not.toBe(502);
    expect(res.status).not.toBe(503);
  });

  it('should reject unauthenticated requests to protected routes', async () => {
    // Temporarily clear tokens to test 401
    const token = api.getAccessToken();
    api.clearTokens();
    const res = await api.get('/customers');
    expect(res.status).toBe(401);
    // Restore token
    if (token) {
      await api.login('admin@gmail.com', 'Admin@123');
    }
  });

  it('should return data from authenticated route', async () => {
    const res = await api.get('/customers');
    expect(res.status).toBe(200);
  });
});
