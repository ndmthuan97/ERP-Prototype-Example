// =============================================================================
// AUTH ADMIN API — auth-service (via gateway /api/auth) — user management
// =============================================================================
// Admin-only user administration endpoints. Role gating is enforced by the
// gateway + auth-service: the gateway verifies the JWT and injects x-user-role
// / x-user-id downstream (see api-gateway main.ts). The FE therefore only needs
// a valid Bearer token — apiClient attaches it automatically — and must NOT (and
// cannot) spoof those headers. The UI additionally gates these calls to admins.

import { apiClient } from './client';
import type { Paginated } from './types';

export type UserRole = 'admin' | 'manager' | 'staff';

/** Row shape returned by GET /api/auth/users (createdAt is an ISO string over HTTP). */
export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface ListUsersParams {
  q?: string;
  page?: number;
  limit?: number;
}

/** Body for POST /api/auth/register. */
export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

/** Response body of POST /api/auth/register (201 Created). */
export interface RegisteredUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/** Body for PATCH /api/auth/users/:id — at least one field required. */
export interface UpdateUserInput {
  role?: UserRole;
  isActive?: boolean;
}

/** Response body of PATCH /api/auth/users/:id. */
export interface UpdatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

/** Response body of GET /api/auth/me. */
export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export const authAdminApi = {
  // Server-side search: `q` (case-insensitive email/fullName match) plus
  // `page`/`limit` are forwarded as query params. buildUrl() drops any that are
  // undefined or empty, so a blank keyword simply omits `q`.
  listUsers: (params?: ListUsersParams) =>
    apiClient.get<Paginated<UserListItem>>(
      'auth',
      '/api/auth/users',
      params as Record<string, string | number | boolean | undefined>,
    ),
  register: (input: RegisterInput) =>
    apiClient.post<RegisteredUser>('auth', '/api/auth/register', input),
  // Admin-only: change a user's role and/or activate/deactivate. Send only the
  // fields being changed — the backend requires at least one to be present.
  updateUser: (id: string, body: { role?: string; isActive?: boolean }) =>
    apiClient.patch<UpdatedUser>('auth', `/api/auth/users/${id}`, body),
  getMe: () => apiClient.get<MeResponse>('auth', '/api/auth/me'),
};
