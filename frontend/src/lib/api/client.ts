// =============================================================================
// API CLIENT — lớp HTTP TẬP TRUNG DUY NHẤT của FE
// =============================================================================
// MỌI call API phải đi qua đây. Lợi ích:
// - Gắn Authorization + x-correlation-id ở 1 chỗ (auth thật chỉ sửa token.ts)
// - Chuẩn hoá lỗi BE → ApiError
// - Xử lý 204 No Content (DELETE customer)
//
// KHÔNG import React ở file này (dùng được cả server/client component).

import { API, type ServiceName } from './config';
import { ApiError, type ApiIssue } from './errors';
import { getAuthToken } from '../auth/token';

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

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

async function request<T>(
  service: ServiceName,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-correlation-id': correlationId(),
  };

  // INTERCEPTOR auth — hiện token = null (mock). Có JWT thật chỉ cần token.ts đổi.
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(buildUrl(API[service], path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body,
    signal: opts.signal,
  });

  // 204 No Content (vd: DELETE /customers/:id)
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
