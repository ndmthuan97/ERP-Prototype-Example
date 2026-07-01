// =============================================================================
// PRODUCT REPOSITORY INTERFACE — Port in Hexagonal / DDD architecture
// =============================================================================
// Domain layer defines the CONTRACT; infrastructure provides implementation.
// Token PRODUCT_REPOSITORY is used for NestJS DI container.

import { Product } from "../entities/index.js";

export const PRODUCT_REPOSITORY = "PRODUCT_REPOSITORY";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchProductsParams {
  query: string;
  page: number;
  limit: number;
  isActive?: boolean;
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  search(params: SearchProductsParams): Promise<PaginatedResult<Product>>;
  create(
    product: Product,
    event?: { eventType: string; payload: unknown },
  ): Promise<Product>;
  update(
    product: Product,
    events?: { eventType: string; payload: unknown }[],
  ): Promise<Product>;
}
