// =============================================================================
// PURCHASING API — purchasing-service :3004
// =============================================================================
// PO lifecycle: draft → placed → partially_received → received → cancelled

import { apiClient } from './client';
import type {
  Paginated,
  PurchaseOrderDetail,
  PurchaseOrderLine,
  CreatePurchaseOrderInput,
  AddPurchaseOrderLineInput,
  ReceiveGoodsInput,
} from './types';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: 'draft' | 'placed' | 'partially_received' | 'received' | 'cancelled';
  totalCost: number;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

const SVC = 'purchasing' as const;

export const purchasingApi = {
  list: (params?: { page?: number; limit?: number; q?: string; status?: string }) =>
    apiClient.get<Paginated<PurchaseOrder>>(SVC, '/api/purchasing/orders', params),

  get: (id: string) =>
    apiClient.get<PurchaseOrderDetail>(SVC, `/api/purchasing/orders/${id}`),

  create: (input: CreatePurchaseOrderInput) =>
    apiClient.post<PurchaseOrderDetail>(SVC, '/api/purchasing/orders', input),

  addLine: (id: string, input: AddPurchaseOrderLineInput) =>
    apiClient.post<PurchaseOrderLine>(SVC, `/api/purchasing/orders/${id}/lines`, input),

  removeLine: (id: string, lineId: string) =>
    apiClient.delete(SVC, `/api/purchasing/orders/${id}/lines/${lineId}`),

  place: (id: string) =>
    apiClient.post<void>(SVC, `/api/purchasing/orders/${id}/place`),

  receiveGoods: (id: string, input: ReceiveGoodsInput) =>
    apiClient.post<PurchaseOrderDetail>(SVC, `/api/purchasing/orders/${id}/receive`, input),

  cancel: (id: string) =>
    apiClient.delete(SVC, `/api/purchasing/orders/${id}`),
};
