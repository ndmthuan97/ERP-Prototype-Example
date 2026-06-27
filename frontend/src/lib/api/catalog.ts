import { apiClient } from './client';
import type { Paginated } from './types';

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  defaultSalePrice: number;
  taxRate: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const catalogApi = {
  list: (params?: any) => apiClient.get<Paginated<Product>>('catalog', '/api/catalog/products', params),
  get: (id: string) => apiClient.get<Product>('catalog', `/api/catalog/products/${id}`),
  create: (data: any) => apiClient.post<Product>('catalog', '/api/catalog/products', data),
  update: (id: string, data: any) => apiClient.patch<Product>('catalog', `/api/catalog/products/${id}`, data),
  deactivate: (id: string) => apiClient.post<void>('catalog', `/api/catalog/products/${id}/deactivate`),
  activate: (id: string) => apiClient.post<void>('catalog', `/api/catalog/products/${id}/activate`),
};
