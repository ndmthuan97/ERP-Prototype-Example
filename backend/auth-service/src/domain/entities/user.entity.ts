// =============================================================================
// USER ENTITY — Core identity entity for Auth bounded context
// =============================================================================
// In DDD, Entity has a unique identity (id) and its own lifecycle.
// User is the Aggregate Root — the single entry point for the Auth aggregate.
// All state changes must go through entity methods to enforce business rules.

import { InvalidRoleError } from '../errors.js';

/**
 * Valid user roles in the system.
 * - admin:   Full access — can manage users, approve, and perform all actions
 * - manager: Can read, create, update, and approve
 * - staff:   Can read and create only
 */
export const USER_ROLES = ['admin', 'manager', 'staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Properties needed to construct/reconstruct a User entity.
 */
export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// RBAC permission matrix
const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set([
    'read',
    'create',
    'update',
    'delete',
    'approve',
    'manage_users',
  ]),
  manager: new Set(['read', 'create', 'update', 'approve']),
  staff: new Set(['read', 'create']),
};

/**
 * User Entity — Aggregate Root for Auth context.
 *
 * Contains business logic for:
 * - Activation / deactivation of user accounts
 * - Role-based access control (RBAC)
 * - Profile updates
 *
 * Domain layer does NOT import from infrastructure — ensuring independence.
 */
export class User {
  readonly id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.fullName = props.fullName;
    this.role = props.role;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  // ==========================================================================
  // BUSINESS METHODS
  // ==========================================================================

  /** Activate the user account */
  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /** Deactivate the user account */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /** Set the account's active status (true = active, false = inactive) */
  setActive(isActive: boolean): void {
    this.isActive = isActive;
    this.updatedAt = new Date();
  }

  /** Change the user's role after validating it is an allowed value */
  changeRole(newRole: UserRole): void {
    if (!USER_ROLES.includes(newRole)) {
      throw new InvalidRoleError(newRole);
    }
    this.role = newRole;
    this.updatedAt = new Date();
  }

  /** Update user profile information */
  updateProfile(fullName: string, email: string): void {
    this.fullName = fullName;
    this.email = email;
    this.updatedAt = new Date();
  }

  /**
   * Basic RBAC check — determines if the user can perform a given action.
   * Admin can do everything; manager and staff have limited permissions.
   */
  canPerform(action: string): boolean {
    if (this.role === 'admin') return true;
    return ROLE_PERMISSIONS[this.role]?.has(action) ?? false;
  }
}
