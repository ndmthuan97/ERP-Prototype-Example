// =============================================================================
// ACTIVATE PRODUCT COMMAND — Use case for activating a product
// =============================================================================

import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import { Product } from '../../domain/entities/index.js';
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from '../../domain/repositories/index.js';
import { EVENT } from '@erp/shared';

@Injectable()
export class ActivateProductCommand {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: "${id}"`);
    }

    product.activate();

    const updatedProduct = await this.productRepository.update(product, [
      {
        eventType: EVENT.PRODUCT_ACTIVATED,
        payload: { id: product.id, sku: product.sku, name: product.name },
      },
    ]);

    return updatedProduct;
  }
}
