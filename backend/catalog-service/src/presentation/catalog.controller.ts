// =============================================================================
// CATALOG CONTROLLER — Presentation Layer
// =============================================================================
// Controller delegates to Application layer (Command/Query).
// No business logic here (Single Responsibility — SOLID "S").

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";

import {
  CreateProductDtoSwagger,
  UpdateProductDtoSwagger,
} from "./swagger.dto.js";
import { CreateProductCommand } from "../application/commands/create-product.command";
import { UpdateProductCommand } from "../application/commands/update-product.command";
import { DeactivateProductCommand } from "../application/commands/deactivate-product.command";
import { ActivateProductCommand } from "../application/commands/activate-product.command";
import { GetProductQuery } from "../application/queries/get-product.query";
import { SearchProductsQuery } from "../application/queries/search-products.query";

@Controller("catalog/products")
export class CatalogController {
  constructor(
    private readonly createProductCommand: CreateProductCommand,
    private readonly updateProductCommand: UpdateProductCommand,
    private readonly deactivateProductCommand: DeactivateProductCommand,
    private readonly activateProductCommand: ActivateProductCommand,
    private readonly getProductQuery: GetProductQuery,
    private readonly searchProductsQuery: SearchProductsQuery,
  ) {}

  /** POST /catalog/products — Create a new product */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateProductDtoSwagger })
  async create(@Body() body: unknown) {
    return this.createProductCommand.execute(body);
  }

  /** GET /catalog/products — Search products with pagination */
  @Get()
  async search(
    @Query("q") query?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("isActive") isActive?: string,
  ) {
    const pageNumber = Number.parseInt(page ?? "", 10);
    const limitNumber = Number.parseInt(limit ?? "", 10);

    // Parse isActive filter: 'true' | 'false' | undefined
    let isActiveFilter: boolean | undefined;
    if (isActive === "true") isActiveFilter = true;
    else if (isActive === "false") isActiveFilter = false;

    return this.searchProductsQuery.execute(
      query ?? "",
      Number.isNaN(pageNumber) ? undefined : pageNumber,
      Number.isNaN(limitNumber) ? undefined : limitNumber,
      isActiveFilter,
    );
  }

  /** GET /catalog/products/:id — Get product by ID or SKU */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.getProductQuery.execute(id);
  }

  /** PATCH /catalog/products/:id — Update product details */
  @Patch(":id")
  @ApiBody({ type: UpdateProductDtoSwagger })
  async update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateProductCommand.execute({ id, ...body });
  }

  /** POST /catalog/products/:id/deactivate — Deactivate a product */
  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param("id") id: string) {
    return this.deactivateProductCommand.execute(id);
  }

  /** POST /catalog/products/:id/activate — Activate a product */
  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  async activate(@Param("id") id: string) {
    return this.activateProductCommand.execute(id);
  }
}
