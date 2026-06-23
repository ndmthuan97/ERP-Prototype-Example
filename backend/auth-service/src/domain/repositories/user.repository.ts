// =============================================================================
// USER REPOSITORY INTERFACE — Port in Hexagonal / DDD architecture
// =============================================================================
// Repository Interface lives in the DOMAIN layer (not infrastructure).
// This is a "port" — defining the CONTRACT that infrastructure must implement.

import { User } from '../entities/user.entity.js';

/** DI token for NestJS container */
export const USER_REPOSITORY = 'USER_REPOSITORY';

/** Paginated result structure */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * IUserRepository — Persistence contract for User aggregate.
 * Methods describe "what" (needed), not "how" (implemented).
 */
export interface IUserRepository {
  /** Find user by ID, returns null if not found */
  findById(id: string): Promise<User | null>;

  /** Find user by email, returns null if not found */
  findByEmail(email: string): Promise<User | null>;

  /** Get paginated list of all users */
  findAll(page: number, limit: number): Promise<PaginatedResult<User>>;

  /** Save (create or update) a user */
  save(user: User): Promise<User>;
}
