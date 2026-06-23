// =============================================================================
// INVENTORY API — inventory-service :3003 (BE sẵn 100%)
// =============================================================================
import { apiClient } from './client';
import type {
  StockItem,
  CreateItemInput,
  Availability,
  Paginated,
} from './types';

const SVC = 'inventory' as const;

export const inventoryApi = {
  list: (params: { q?: string; page?: number; limit?: number }) =>
    apiClient.get<Paginated<StockItem>>(SVC, '/api/inventory/items', {
      q: params.q,
      page: params.page,
      limit: params.limit,
    }),

  get: (sku: string) =>
    apiClient.get<StockItem>(SVC, `/api/inventory/items/${encodeURIComponent(sku)}`),

  create: (input: CreateItemInput) =>
    apiClient.post<StockItem>(SVC, '/api/inventory/items', input),

  /** Nhập kho */
  receive: (sku: string, quantity: number) =>
    apiClient.post<StockItem>(
      SVC,
      `/api/inventory/items/${encodeURIComponent(sku)}/receive`,
      { quantity },
    ),

  availability: (sku: string, quantity = 1) =>
    apiClient.get<Availability>(
      SVC,
      `/api/inventory/items/${encodeURIComponent(sku)}/availability`,
      { quantity },
    ),
};
