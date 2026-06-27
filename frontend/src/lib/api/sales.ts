// =============================================================================
// SALES/ORDER API — sales-service :3002
// =============================================================================
// Order lifecycle, Delivery Order, and Sales Return endpoints.

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
  DeliveryOrder,
  CreateDeliveryInput,
  SalesReturn,
  CreateReturnInput,
} from './types';

const SVC = 'sales' as const;

// ----- Sales Order -----

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

  submit: (id: string) => apiClient.post<SubmitResult>(SVC, `/api/orders/${id}/submit`),
  cancel: (id: string, reason: string) =>
    apiClient.post<CancelResult>(SVC, `/api/orders/${id}/cancel`, { reason }),
};

// ----- Delivery Order -----

export const deliveryApi = {
  list: (orderId: string) =>
    apiClient.get<DeliveryOrder[]>(SVC, `/api/orders/${orderId}/deliveries`),

  create: (orderId: string, input: CreateDeliveryInput) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries`, input),

  startPicking: (orderId: string, doId: string) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries/${doId}/start-picking`),

  pack: (orderId: string, doId: string) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries/${doId}/pack`),

  ship: (orderId: string, doId: string) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries/${doId}/ship`),

  deliver: (orderId: string, doId: string) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries/${doId}/deliver`),

  fail: (orderId: string, doId: string, reason?: string) =>
    apiClient.post<DeliveryOrder>(SVC, `/api/orders/${orderId}/deliveries/${doId}/fail`, { reason }),
};

// ----- Sales Return -----

export const returnApi = {
  list: (orderId: string) =>
    apiClient.get<SalesReturn[]>(SVC, `/api/orders/${orderId}/returns`),

  create: (orderId: string, input: CreateReturnInput) =>
    apiClient.post<SalesReturn>(SVC, `/api/orders/${orderId}/returns`, input),

  approve: (orderId: string, returnId: string) =>
    apiClient.post<SalesReturn>(SVC, `/api/orders/${orderId}/returns/${returnId}/approve`),

  reject: (orderId: string, returnId: string) =>
    apiClient.post<SalesReturn>(SVC, `/api/orders/${orderId}/returns/${returnId}/reject`),

  receiveGoods: (orderId: string, returnId: string) =>
    apiClient.post<SalesReturn>(SVC, `/api/orders/${orderId}/returns/${returnId}/receive-goods`),

  complete: (orderId: string, returnId: string) =>
    apiClient.post<SalesReturn>(SVC, `/api/orders/${orderId}/returns/${returnId}/complete`),
};
