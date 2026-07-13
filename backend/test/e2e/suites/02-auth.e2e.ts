/**
 * Suite 02 — Auth Flow (B1: Google sign-in + server-side session whitelist)
 *
 * Password login and refresh tokens were removed in B1. Auth now works by
 * exchanging a Firebase ID token at POST /auth/sso/callback for an app access
 * token that carries a server-side session id (`sid`). Revocation is instant:
 * logout deletes the session, and the gateway's per-request whitelist check
 * then 401s any request bearing that token (FR-A13).
 *
 * The shared token (from globalSetup) must stay valid for later suites, so the
 * logout/revocation test drives a SEPARATE session minted from the same ID token.
 */
import axios from 'axios';
import * as api from '../helpers/api';
import { seedTestData } from '../helpers/seed';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3010';

/** A one-off client that always sends the given token (independent of the shared one). */
const withToken = (token: string) =>
  axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    validateStatus: () => true,
    headers: { Authorization: `Bearer ${token}` },
  });

describe('02 — Auth Flow (B1)', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  it('has a valid app access token from the SSO exchange in globalSetup', () => {
    const token = api.getAccessToken();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(0);
  });

  it('rejects protected routes without a token (401)', async () => {
    const saved = api.getAccessToken()!;
    api.clearTokens();
    const res = await api.get('/customers');
    expect(res.status).toBe(401);
    api.setAccessToken(saved); // restore for later suites
  });

  it('accepts protected routes with a valid token (200)', async () => {
    const res = await api.get('/customers');
    expect(res.status).toBe(200);
  });

  it('returns the current user via /auth/me', async () => {
    const res = await api.get('/auth/me');
    expect(res.status).toBe(200);
    expect(typeof res.data.email).toBe('string');
    expect(res.data.role).toBeDefined();
  });

  it('logout revokes the session instantly — the token 401s afterwards (FR-A13)', async () => {
    // Mint a SEPARATE session so the shared token stays alive for later suites.
    const idToken = process.env.E2E_ID_TOKEN;
    expect(idToken).toBeTruthy();

    const ex = await api.raw('POST', '/api/auth/sso/callback', { idToken });
    expect(ex.status).toBe(200);
    const token2: string = ex.data.accessToken;
    const c2 = withToken(token2);

    // token2 works before logout
    expect((await c2.get('/api/customers')).status).toBe(200);

    // logout token2 → its session is deleted
    const out = await c2.post('/api/auth/logout', {});
    expect([200, 204]).toContain(out.status);

    // the SAME token2 is now rejected within the same run (whitelist miss → 401)
    expect((await c2.get('/api/customers')).status).toBe(401);

    // the shared token is unaffected (a different session)
    expect((await api.get('/customers')).status).toBe(200);
  });
});
