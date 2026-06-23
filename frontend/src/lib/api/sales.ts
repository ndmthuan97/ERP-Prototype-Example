// =============================================================================
// SALES/ORDER API — sales-service :3002
// =============================================================================
// Phần DRAFT sẵn dùng. Phần SAGA (submit/cancel) GATED đến khi BE fix C1+C2:
// hiện submit trả 200 nhưng đơn KẸT ở "submitted" (inventory chưa subscribe).

import { apiClient } from './client';
import type {
  SalesOrder,
  SalesOrderLine,
  SalesOrderSummary,
  CreateOrderInput,
  AddLineInput,
  LifecycleResponse,
  SubmitResult,
  CancelResult,
  PaginatedMeta,
} from './types';

const SVC = 'sales' as const;

export const salesApi = {
  list: (params: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<PaginatedMeta<SalesOrderSummary>>(SVC, '/api/orders', {
      page: params.page,
      limit: params.limit,
      status: params.status,
    }),

  get: (id: string) => apiClient.get<SalesOrder>(SVC, `/api/orders/${id}`),

  lifecycle: (id: string) =>
    apiClient.get<LifecycleResponse>(SVC, `/api/orders/${id}/lifecycle`),

  createDraft: (input: CreateOrderInput) =>
    apiClient.post<SalesOrder>(SVC, '/api/orders', input),

  addLine: (id: string, input: AddLineInput) =>
    apiClient.post<SalesOrderLine>(SVC, `/api/orders/${id}/lines`, input),

  // ⚠️ GATED — chỉ bật khi BE fix C1 (inventory subscriber) + C2 (schema outbox).
  submit: (id: string) => apiClient.post<SubmitResult>(SVC, `/api/orders/${id}/submit`),
  cancel: (id: string, reason: string) =>
    apiClient.post<CancelResult>(SVC, `/api/orders/${id}/cancel`, { reason }),
};

/** Cờ tính năng: bật khi BE đã nối saga (C1+C2). */
export const SAGA_ENABLED = true;
