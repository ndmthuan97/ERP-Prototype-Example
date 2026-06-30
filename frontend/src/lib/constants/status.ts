// =============================================================================
// CENTRALIZED STATUS MAPS — color + label for all entity statuses
// =============================================================================

export const ORDER_STATUS = {
  color: {
    draft: 'default',
    submitted: 'processing',
    confirmed: 'success',
    partially_delivered: 'warning',
    fully_delivered: 'cyan',
    cancelled: 'error',
  } as Record<string, string>,
  label: {
    draft: 'Draft',
    submitted: 'Submitted',
    confirmed: 'Confirmed',
    partially_delivered: 'Partially Delivered',
    fully_delivered: 'Fully Delivered',
    cancelled: 'Cancelled',
  } as Record<string, string>,
};

export const CUSTOMER_STATUS = {
  color: {
    prospect: 'default',
    active: 'green',
    suspended: 'orange',
    archived: 'red',
  } as Record<string, string>,
  label: {
    prospect: 'Prospect',
    active: 'Active',
    suspended: 'Suspended',
    archived: 'Archived',
  } as Record<string, string>,
};

export const PO_STATUS = {
  color: {
    draft: 'default',
    placed: 'processing',
    partially_received: 'warning',
    received: 'success',
    cancelled: 'error',
  } as Record<string, string>,
  label: {
    draft: 'Draft',
    placed: 'Placed',
    partially_received: 'Partially Received',
    received: 'Received',
    cancelled: 'Cancelled',
  } as Record<string, string>,
};

export const DELIVERY_STATUS = {
  color: {
    draft: 'default',
    picking: 'processing',
    packed: 'warning',
    shipped: 'blue',
    delivered: 'success',
    failed: 'error',
  } as Record<string, string>,
  label: {
    draft: 'Draft',
    picking: 'Picking',
    packed: 'Packed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    failed: 'Failed',
  } as Record<string, string>,
};

export const RETURN_STATUS = {
  color: {
    draft: 'default',
    approved: 'processing',
    goods_received: 'warning',
    completed: 'success',
    rejected: 'error',
  } as Record<string, string>,
  label: {
    draft: 'Draft',
    approved: 'Approved',
    goods_received: 'Goods Received',
    completed: 'Completed',
    rejected: 'Rejected',
  } as Record<string, string>,
};

/** Get label for any status, fallback to raw key */
export function statusLabel(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}
