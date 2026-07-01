// =============================================================================
// DEACTIVATE PRODUCT COMMAND — Use case for deactivating a product
// =============================================================================

import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import { Product } from "../../domain/entities/index.js";
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from "../../domain/repositories/index.js";
import { EVENT } from "@erp/shared";

@Injectable()
export class DeactivateProductCommand {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: "${id}"`);
    }

    product.deactivate();

    // Pull domain events raised by deactivate() and forward to outbox
    const domainEvents = product.pullDomainEvents();
    const outboxEvents = domainEvents.map((evt) => ({
      eventType: evt.eventType,
      payload: evt.payload,
    }));

    // Fallback: ensure at least one deactivated event
    if (outboxEvents.length === 0) {
      outboxEvents.push({
        eventType: EVENT.PRODUCT_DEACTIVATED,
        payload: { id: product.id, sku: product.sku, name: product.name },
      });
    }

    const updatedProduct = await this.productRepository.update(
      product,
      outboxEvents,
    );
    return updatedProduct;
  }
}
