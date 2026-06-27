// =============================================================================
// SUPPLIER API — purchasing-service :3004 (via gateway /api/suppliers)
// =============================================================================

import { apiClient } from './client';
import type {
  Paginated,
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
} from './types';

// Supplier routes go through gateway as /api/suppliers → purchasing-service
const SVC = 'purchasing' as const;

export const supplierApi = {
  list: (params?: { page?: number; limit?: number; q?: string; isActive?: boolean }) =>
    apiClient.get<Paginated<Supplier>>(SVC, '/api/suppliers', params as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<Supplier>(SVC, `/api/suppliers/${id}`),

  create: (input: CreateSupplierInput) =>
    apiClient.post<Supplier>(SVC, '/api/suppliers', input),

  update: (id: string, input: UpdateSupplierInput) =>
    apiClient.patch<Supplier>(SVC, `/api/suppliers/${id}`, input),
};
