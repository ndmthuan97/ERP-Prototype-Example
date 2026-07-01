// =============================================================================
// UPDATE PRODUCT COMMAND — Use case for updating product details
// =============================================================================

import { Injectable, Inject, NotFoundException } from "@nestjs/common";

import { Product } from "../../domain/entities/index.js";
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from "../../domain/repositories/index.js";
import { validateUpdateProduct } from "../dtos/index.js";
import { EVENT } from "@erp/shared";

@Injectable()
export class UpdateProductCommand {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(dto: unknown): Promise<Product> {
    const validatedData = validateUpdateProduct(dto);

    const product = await this.productRepository.findById(validatedData.id);
    if (!product) {
      throw new NotFoundException(`Product not found: "${validatedData.id}"`);
    }

    // Apply changes via entity methods (enforces invariants)
    if (validatedData.name !== undefined) {
      product.rename(validatedData.name);
    }
    if (validatedData.defaultSalePrice !== undefined) {
      product.changePrice(validatedData.defaultSalePrice);
    }
    if (validatedData.unit !== undefined) {
      product.changeUnit(validatedData.unit);
    }
    if (validatedData.taxRate !== undefined) {
      product.changeTaxRate(validatedData.taxRate);
    }

    const updatedProduct = await this.productRepository.update(product, [
      {
        eventType: EVENT.PRODUCT_UPDATED,
        payload: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          defaultSalePrice: String(product.defaultSalePrice),
          taxRate: String(product.taxRate),
          isActive: product.isActive,
        },
      },
    ]);

    return updatedProduct;
  }
}
