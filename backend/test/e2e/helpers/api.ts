/**
 * E2E Test — API Client Helper
 *
 * Wraps axios for making HTTP requests to the API Gateway.
 * Handles JWT token management automatically.
 *
 * IMPORTANT: Uses globalThis to persist tokens across Jest module reloads
 * (Jest clears module cache between test files even with --runInBand).
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3010';

// Persist tokens via globalThis (survives Jest module cache clearing)
const G = globalThis as any;
const TOKEN_KEY = '__E2E_ACCESS_TOKEN__';

/** Create axios instance with base config */
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  validateStatus: () => true, // Don't throw on non-2xx
});

// Auto-attach the shared app access token — but never clobber an Authorization
// header a caller set explicitly (used to drive a second, separate session).
client.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = G[TOKEN_KEY];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ---- Auth helpers (B1: Google sign-in + server-side session whitelist) ----
// Password login / refresh tokens were removed in B1. The token comes from
// exchanging a Firebase ID token at POST /auth/sso/callback (see global-setup).

/** End the shared session (FR-A13 instant revoke) and drop the cached token. */
export async function logout(): Promise<AxiosResponse> {
  const res = await client.post('/api/auth/logout', {});
  clearTokens();
  return res;
}

export function clearTokens(): void {
  G[TOKEN_KEY] = null;
}

export function getAccessToken(): string | null {
  return G[TOKEN_KEY] || null;
}

export function setAccessToken(token: string): void {
  G[TOKEN_KEY] = token;
}

// ---- Generic HTTP helpers ----

export function get(path: string): Promise<AxiosResponse> {
  return client.get(`/api${path}`);
}

export function post(
  path: string,
  data?: Record<string, unknown>,
): Promise<AxiosResponse> {
  return client.post(`/api${path}`, data);
}

export function patch(
  path: string,
  data?: Record<string, unknown>,
): Promise<AxiosResponse> {
  return client.patch(`/api${path}`, data);
}

export function del(path: string): Promise<AxiosResponse> {
  return client.delete(`/api${path}`);
}

/** Make raw request without /api prefix (for health checks) */
export function raw(method: string, url: string, data?: unknown): Promise<AxiosResponse> {
  return client.request({ method, url, data });
}

export { client };
