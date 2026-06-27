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
const REFRESH_KEY = '__E2E_REFRESH_TOKEN__';

/** Create axios instance with base config */
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  validateStatus: () => true, // Don't throw on non-2xx
});

// Auto-attach JWT to all requests
client.interceptors.request.use((config) => {
  const token = G[TOKEN_KEY];
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Auth helpers ----

export async function login(
  email: string,
  password: string,
): Promise<AxiosResponse> {
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status === 200 && res.data.accessToken) {
    G[TOKEN_KEY] = res.data.accessToken;
    G[REFRESH_KEY] = res.data.refreshToken;
  }
  return res;
}

export async function refresh(): Promise<AxiosResponse> {
  const res = await client.post('/api/auth/refresh', {
    refreshToken: G[REFRESH_KEY],
  });
  if (res.status === 200 && res.data.accessToken) {
    G[TOKEN_KEY] = res.data.accessToken;
    G[REFRESH_KEY] = res.data.refreshToken;
  }
  return res;
}

export function clearTokens(): void {
  G[TOKEN_KEY] = null;
  G[REFRESH_KEY] = null;
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
