// =============================================================================
// RBAC PERMISSIONS — matches Business Requirements §2 permission matrix
// =============================================================================

import type { Role } from '../auth/AuthProvider';

export const CAN = {
  update: (role: Role) => role === 'admin' || role === 'manager',
  delete: (role: Role) => role === 'admin',
  cancelOrder: (role: Role) => role === 'admin' || role === 'manager',
  manageUsers: (role: Role) => role === 'admin',
  viewAuditLogs: (role: Role) => role === 'admin' || role === 'manager',
} as const;
