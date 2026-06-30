// =============================================================================
// CATALOG API — catalog-service :3005 (via gateway /api/catalog)
// =============================================================================

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

export interface CreateProductInput {
  sku: string;
  name: string;
  unit: string;
  defaultSalePrice: number;
  taxRate?: number;
}

export type UpdateProductInput = Partial<CreateProductInput>;

interface CatalogListParams {
  q?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
}

export const catalogApi = {
  list: (params?: CatalogListParams) =>
    apiClient.get<Paginated<Product>>('catalog', '/api/catalog/products', params as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<Product>('catalog', `/api/catalog/products/${id}`),
  create: (data: CreateProductInput) => apiClient.post<Product>('catalog', '/api/catalog/products', data),
  update: (id: string, data: UpdateProductInput) => apiClient.patch<Product>('catalog', `/api/catalog/products/${id}`, data),
  deactivate: (id: string) => apiClient.post<void>('catalog', `/api/catalog/products/${id}/deactivate`),
  activate: (id: string) => apiClient.post<void>('catalog', `/api/catalog/products/${id}/activate`),
};
