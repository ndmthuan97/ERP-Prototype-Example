// =============================================================================
// RBAC PERMISSIONS — matches Business Requirements §2 permission matrix
// =============================================================================
// SINGLE SOURCE OF TRUTH: both the CAN helper (runtime checks scattered across
// pages) and the read-only Roles & Permissions page derive from PERMISSIONS,
// so the rendered matrix can never drift from what the code actually enforces.

import type { Role } from '../auth/AuthProvider';

// Roles surfaced in the matrix — the 3 seeded/enforced roles (rbac.md §2).
// 'viewer' exists in the type but is not used by the app, so it is omitted.
export const RBAC_ROLES: Role[] = ['admin', 'manager', 'staff'];

export interface PermissionDef {
  key: string;
  label: string; // human-facing name (vi)
  description: string; // what the permission governs
  roles: Role[]; // roles that hold it
}

export const PERMISSIONS: PermissionDef[] = [
  {
    key: 'update',
    label: 'Sửa record',
    description: 'Chỉnh sửa dữ liệu đã tạo (customer, order, …)',
    roles: ['admin', 'manager'],
  },
  {
    key: 'delete',
    label: 'Xóa record',
    description: 'Xóa dữ liệu khỏi hệ thống',
    roles: ['admin'],
  },
  {
    key: 'cancelOrder',
    label: 'Hủy đơn hàng',
    description: 'Hủy một sales order',
    roles: ['admin', 'manager'],
  },
  {
    key: 'manageUsers',
    label: 'Quản lý user',
    description: 'Tạo user, đổi role, khóa/mở user',
    roles: ['admin'],
  },
  {
    key: 'viewAuditLogs',
    label: 'Xem audit log',
    description: 'Xem nhật ký thao tác của hệ thống',
    roles: ['admin', 'manager'],
  },
];

function allows(key: string, role: Role): boolean {
  const def = PERMISSIONS.find((p) => p.key === key);
  return !!def && def.roles.includes(role);
}

// Back-compat helper used across pages (e.g. CAN.update, CAN.delete). Derived
// from PERMISSIONS so it stays in lock-step with the matrix shown in the UI.
export const CAN = {
  update: (role: Role) => allows('update', role),
  delete: (role: Role) => allows('delete', role),
  cancelOrder: (role: Role) => allows('cancelOrder', role),
  manageUsers: (role: Role) => allows('manageUsers', role),
  viewAuditLogs: (role: Role) => allows('viewAuditLogs', role),
} as const;
