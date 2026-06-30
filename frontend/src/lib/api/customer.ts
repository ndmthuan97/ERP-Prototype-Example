// =============================================================================
// CUSTOMER API — customer-service :3001 (BE sẵn 100%)
// =============================================================================
import { apiClient } from './client';
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreditCheck,
  Paginated,
} from './types';

const SVC = 'customer' as const;

export const customerApi = {
  list: (params: { q?: string; page?: number; limit?: number; status?: string }) =>
    apiClient.get<Paginated<Customer>>(SVC, '/api/customers', {
      q: params.q,
      page: params.page,
      limit: params.limit,
      status: params.status,
    }),

  get: (id: string) => apiClient.get<Customer>(SVC, `/api/customers/${id}`),

  create: (input: CreateCustomerInput) =>
    apiClient.post<Customer>(SVC, '/api/customers', input),

  update: (id: string, input: UpdateCustomerInput) =>
    apiClient.patch<Customer>(SVC, `/api/customers/${id}`, input),

  /** Soft delete → 204 No Content */
  remove: (id: string) => apiClient.delete<void>(SVC, `/api/customers/${id}`),

  creditCheck: (id: string) =>
    apiClient.get<CreditCheck>(SVC, `/api/customers/${id}/credit-check`),
};
