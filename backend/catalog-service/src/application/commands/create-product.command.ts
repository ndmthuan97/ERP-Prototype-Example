// =============================================================================
// CREATE PRODUCT COMMAND — Use case for creating a new product
// =============================================================================

import { Injectable, Inject, ConflictException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { Product } from "../../domain/entities/index.js";
import {
  PRODUCT_REPOSITORY,
  type IProductRepository,
} from "../../domain/repositories/index.js";
import { validateCreateProduct } from "../dtos/index.js";
import { EVENT } from "@erp/shared";

@Injectable()
export class CreateProductCommand {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(dto: unknown): Promise<Product> {
    const validatedData = validateCreateProduct(dto);

    // Check unique SKU before creating
    const normalizedSku = validatedData.sku.trim().toUpperCase();
    const existingProduct =
      await this.productRepository.findBySku(normalizedSku);
    if (existingProduct) {
      throw new ConflictException(
        `SKU "${normalizedSku}" already exists (product: "${existingProduct.name}")`,
      );
    }

    const product = Product.create(
      uuidv4(),
      validatedData.sku,
      validatedData.name,
      validatedData.unit ?? "PCS",
      validatedData.defaultSalePrice ?? 0,
    );

    const savedProduct = await this.productRepository.create(product, {
      eventType: EVENT.PRODUCT_CREATED,
      payload: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        defaultSalePrice: String(product.defaultSalePrice),
        isActive: product.isActive,
      },
    });

    return savedProduct;
  }
}
