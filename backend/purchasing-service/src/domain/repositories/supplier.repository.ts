// =============================================================================
// SUPPLIER REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { Supplier } from '../entities/supplier.entity.js';

export const SUPPLIER_REPOSITORY = 'SUPPLIER_REPOSITORY';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchSuppliersParams {
  query?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface ISupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  findAll(params: SearchSuppliersParams): Promise<PaginatedResult<Supplier>>;
  save(supplier: Supplier): Promise<Supplier>;
  update(supplier: Supplier): Promise<Supplier>;
}
