import { apiClient } from './client';
import type { Paginated } from './types';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: 'draft' | 'placed' | 'partially_received' | 'received' | 'cancelled';
  totalCost: number;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

export const purchasingApi = {
  list: (params?: any) => apiClient.get<Paginated<PurchaseOrder>>('purchasing', '/api/purchasing/orders', params),
  get: (id: string) => apiClient.get<PurchaseOrder>('purchasing', `/api/purchasing/orders/${id}`),
  create: (data: any) => apiClient.post<PurchaseOrder>('purchasing', '/api/purchasing/orders', data),
  place: (id: string) => apiClient.post<void>('purchasing', `/api/purchasing/orders/${id}/place`),
};
