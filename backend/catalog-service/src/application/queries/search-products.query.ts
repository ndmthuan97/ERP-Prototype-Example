// =============================================================================
// SEARCH PRODUCTS QUERY — Use case for searching products with pagination
// =============================================================================

import { Injectable, Inject } from "@nestjs/common";

import { Product } from "../../domain/entities/index.js";
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
  type PaginatedResult,
} from "../../domain/repositories/index.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class SearchProductsQuery {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(
    query: string = "",
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE,
    isActive?: boolean,
  ): Promise<PaginatedResult<Product>> {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

    return this.productRepository.search({
      query: query.trim(),
      page: normalizedPage,
      limit: normalizedLimit,
      isActive,
    });
  }
}
