// =============================================================================
// Swagger DTO classes — bridge existing Zod schemas → OpenAPI via nestjs-zod
// =============================================================================
// These classes exist ONLY so @nestjs/swagger can render real request-body
// schemas in /docs. They wrap the SAME Zod schemas already used for runtime
// validation (single source of truth). Runtime validation is unchanged — the
// application commands still call the existing `validateXxx()` helpers.
import { createZodDto } from 'nestjs-zod';

import { createProductSchema } from '../application/dtos/create-product.dto.js';
import { updateProductSchema } from '../application/dtos/update-product.dto.js';

// Body sent to POST /catalog/products
export class CreateProductDtoSwagger extends createZodDto(createProductSchema) {}

// Body sent to PATCH /catalog/products/:id — `id` comes from the URL param and
// is injected by the controller before validation, so it is omitted from the
// documented request body (client does not send it).
const updateProductBodySchema = updateProductSchema.omit({ id: true });
export class UpdateProductDtoSwagger extends createZodDto(
  updateProductBodySchema,
) {}
