// Barrel export cho domain entities
// Tập trung re-export để các layer khác import gọn: import { Customer } from '../domain/entities'
export { Customer } from './customer.entity.js';
export type { CustomerProps, CustomerStatus } from './customer.entity.js';
