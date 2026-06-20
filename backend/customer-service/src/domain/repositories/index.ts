// Barrel export cho domain repositories
// Re-export interface và token để các layer khác import gọn
export { CUSTOMER_REPOSITORY } from './customer.repository.js';
export type {
  ICustomerRepository,
  PaginatedResult,
} from './customer.repository.js';
