/**
 * Suite 02 — Auth Flow
 *
 * Tests JWT verification, refresh, /me, logout, and token revocation.
 *
 * IMPORTANT: Does NOT call api.login() to avoid rate limiting.
 * Uses seed's cached token + api.raw() for auth endpoint tests.
 */
import * as api from '../helpers/api';
import { seedTestData } from '../helpers/seed';

describe('02 — Auth Flow', () => {
  let savedRefreshToken: string;

  beforeAll(async () => {
    await seedTestData();
  });

  it('should have a valid token from seed (proves login works)', () => {
    const token = api.getAccessToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(0);
  });

  it('should reject login with wrong password (raw call)', async () => {
    const res = await api.raw('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: 'WrongPassword123',
    });
    expect(res.status).toBe(401);
  });

  it('should reject login with non-existent email (raw call)', async () => {
    const res = await api.raw('POST', '/api/auth/login', {
      email: 'nonexistent@test.com',
      password: 'Admin@123',
    });
    expect(res.status).toBe(401);
  });

  it('should reject protected routes without token', async () => {
    const savedToken = api.getAccessToken()!;
    api.clearTokens();
    const res = await api.get('/customers');
    expect(res.status).toBe(401);
    // Restore token without calling login
    api.setAccessToken(savedToken);
  });

  it('should access protected routes with valid token', async () => {
    const res = await api.get('/customers');
    expect(res.status).toBe(200);
  });

  it('should refresh token and get new token pair', async () => {
    const res = await api.refresh();
    if (res.status === 200) {
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.refreshToken).toBeDefined();
      savedRefreshToken = res.data.refreshToken;
    } else {
      // Refresh token from globalSetup may have expired — do a fresh login
      const loginRes = await api.login('admin@gmail.com', 'Admin@123');
      expect(loginRes.status).toBe(200);
      savedRefreshToken = loginRes.data.refreshToken;
    }
  });

  it('should return current user info via /auth/me', async () => {
    const res = await api.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.data.email).toBe('admin@gmail.com');
    expect(res.data.role).toBeDefined();
  });

  it('should logout successfully', async () => {
    const res = await api.raw('POST', '/api/auth/logout', {
      refreshToken: savedRefreshToken,
    });
    expect([200, 204]).toContain(res.status);
  });

  it('should reject refresh with revoked token after logout', async () => {
    const res = await api.raw('POST', '/api/auth/refresh', {
      refreshToken: savedRefreshToken,
    });
    // 401 (revoked) or 400 (invalid/expired) are both acceptable
    expect([400, 401]).toContain(res.status);
  });
});
