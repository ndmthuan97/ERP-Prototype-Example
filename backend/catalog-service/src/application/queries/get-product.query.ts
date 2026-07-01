// =============================================================================
// GET PRODUCT QUERY — Use case for fetching a single product by ID or SKU
// =============================================================================

import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import { Product } from "../../domain/entities/index.js";
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from "../../domain/repositories/index.js";

@Injectable()
export class GetProductQuery {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(idOrSku: string): Promise<Product> {
    // Try by ID first (UUID pattern), then by SKU
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSku,
      );

    let product: Product | null = null;

    if (isUuid) {
      product = await this.productRepository.findById(idOrSku);
    }

    if (!product) {
      product = await this.productRepository.findBySku(idOrSku);
    }

    if (!product) {
      throw new NotFoundException(`Product not found: "${idOrSku}"`);
    }

    return product;
  }
}
