// =============================================================================
// Swagger DTO classes — bridge existing Zod schemas → OpenAPI via nestjs-zod
// =============================================================================
// These classes exist ONLY so @nestjs/swagger can render real request-body
// schemas in /docs. They wrap the SAME Zod schemas already used for runtime
// validation (single source of truth). Runtime validation is unchanged — the
// application commands still call the existing `validateXxx()` helpers.
import { createZodDto } from 'nestjs-zod';

import {
  createItemSchema,
  receiveStockSchema,
  reserveStockSchema,
  releaseStockSchema,
  issueStockSchema,
  reserveBatchSchema,
  releaseBatchSchema,
} from '../application/dtos/index.js';

export class CreateItemDtoSwagger extends createZodDto(createItemSchema) {}
export class ReceiveStockDtoSwagger extends createZodDto(receiveStockSchema) {}
export class ReserveStockDtoSwagger extends createZodDto(reserveStockSchema) {}
export class ReleaseStockDtoSwagger extends createZodDto(releaseStockSchema) {}
export class IssueStockDtoSwagger extends createZodDto(issueStockSchema) {}
export class ReserveBatchDtoSwagger extends createZodDto(reserveBatchSchema) {}
export class ReleaseBatchDtoSwagger extends createZodDto(releaseBatchSchema) {}
