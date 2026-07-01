// =============================================================================
// API CLIENT — lớp HTTP TẬP TRUNG DUY NHẤT của FE
// =============================================================================
// MỌI call API phải đi qua đây. Lợi ích:
// - Gắn Authorization + x-correlation-id ở 1 chỗ
// - Token refresh interceptor: auto-refresh khi 401
// - Chuẩn hoá lỗi BE → ApiError
// - Xử lý 204 No Content (DELETE customer)

import { API, type ServiceName } from './config';
import { ApiError, type ApiIssue } from './errors';
import {
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
  clearTokens,
} from '../auth/token';

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

// Mutex for token refresh — prevents multiple concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

// Guards against a stampede of concurrent 401s each firing window.location =
// '/login' (a dashboard fires several queries at once). Only the first redirects.
let redirecting = false;

function buildUrl(
  base: string,
  path: string,
  query?: RequestOptions['query'],
): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  const url = new URL(path.replace(/^\//, ''), root);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function correlationId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `fe-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if refresh succeeded, false otherwise.
 * Uses a mutex so only one refresh happens at a time.
 */
function tryRefreshToken(): Promise<boolean> {
  // Reuse the in-flight refresh if one is already running (real mutex).
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(buildUrl(API.auth, '/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.accessToken) {
        setAuthToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  })().finally(() => {
    // Reset on the promise chain itself so the mutex is released exactly once,
    // only after the single refresh settles — not per awaiting caller.
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(
  service: ServiceName,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-correlation-id': correlationId(),
  };

  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const url = buildUrl(API[service], path, opts.query);

  let res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body,
    signal: opts.signal,
  });

  // 401 → attempt token refresh, then retry once
  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = { ...headers };
      const newToken = getAuthToken();
      if (newToken) retryHeaders.Authorization = `Bearer ${newToken}`;

      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: retryHeaders,
        body,
        signal: opts.signal,
      });
    }

    // Still 401 after refresh attempt → redirect to login (once).
    if (res.status === 401) {
      clearTokens();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login') &&
        !redirecting
      ) {
        redirecting = true;
        window.location.href = '/login';
      }
    }
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = data as
      | { message?: string; issues?: ApiIssue[] }
      | undefined;
    const issues = Array.isArray(err?.issues) ? err!.issues : [];
    const message = err?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, issues, data);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const apiClient = {
  get: <T>(
    service: ServiceName,
    path: string,
    query?: RequestOptions['query'],
    signal?: AbortSignal,
  ) => request<T>(service, path, { method: 'GET', query, signal }),
  post: <T>(service: ServiceName, path: string, body?: unknown) =>
    request<T>(service, path, { method: 'POST', body }),
  patch: <T>(service: ServiceName, path: string, body?: unknown) =>
    request<T>(service, path, { method: 'PATCH', body }),
  delete: <T>(service: ServiceName, path: string) =>
    request<T>(service, path, { method: 'DELETE' }),
};
