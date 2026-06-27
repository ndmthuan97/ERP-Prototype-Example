/**
 * E2E Test — Cleanup Helper
 *
 * Soft-cleanup test data created during E2E runs.
 * Does NOT hard-delete — respects DB constraints & audit trails.
 */
import * as api from './api';

/**
 * Cancel a sales order (if cancellable).
 * Silently ignores errors (order may already be cancelled/fulfilled).
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await api.post(`/orders/${orderId}/cancel`, {
    reason: 'E2E test cleanup',
  });
}

/**
 * Delete (soft) a customer.
 */
export async function deleteCustomer(customerId: string): Promise<void> {
  await api.del(`/customers/${customerId}`);
}

/**
 * Deactivate a product.
 */
export async function deactivateProduct(productId: string): Promise<void> {
  await api.post(`/catalog/products/${productId}/deactivate`);
}
