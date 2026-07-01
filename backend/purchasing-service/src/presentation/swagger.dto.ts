// =============================================================================
// Swagger DTO classes — bridge existing Zod schemas → OpenAPI via nestjs-zod
// =============================================================================
// These classes exist ONLY so @nestjs/swagger can render real request-body
// schemas in /docs. They wrap the SAME Zod schemas already used for runtime
// validation (single source of truth). Runtime validation is unchanged — the
// application commands still call the existing `validateXxx()` helpers.
import { createZodDto } from "nestjs-zod";

import {
  createPOSchema,
  addLinePOSchema,
  receiveGoodsSchema,
  cancelPOSchema,
  createSupplierSchema,
  updateSupplierSchema,
} from "../application/dtos/purchasing.dto.js";

// --- Purchase Order endpoints ---
export class CreatePODtoSwagger extends createZodDto(createPOSchema) {}
export class AddLinePODtoSwagger extends createZodDto(addLinePOSchema) {}
export class ReceiveGoodsDtoSwagger extends createZodDto(receiveGoodsSchema) {}
export class CancelPODtoSwagger extends createZodDto(cancelPOSchema) {}

// --- Supplier endpoints ---
export class CreateSupplierDtoSwagger extends createZodDto(
  createSupplierSchema,
) {}
export class UpdateSupplierDtoSwagger extends createZodDto(
  updateSupplierSchema,
) {}
