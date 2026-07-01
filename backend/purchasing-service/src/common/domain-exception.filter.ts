// =============================================================================
// DOMAIN EXCEPTION FILTER — Map domain errors → HTTP 400/409
// =============================================================================
// Catches domain-specific errors (InvalidPOStatusError, LineNotFoundError,
// OverReceiveError, EmptyPurchaseOrderError) and translates them to
// appropriate HTTP responses.

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import {
  InvalidPOStatusError,
  LineNotFoundError,
  OverReceiveError,
  EmptyPurchaseOrderError,
} from "../domain/entities/index.js";

@Catch(
  InvalidPOStatusError,
  LineNotFoundError,
  OverReceiveError,
  EmptyPurchaseOrderError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let statusCode = HttpStatus.BAD_REQUEST;
    if (exception instanceof LineNotFoundError) {
      statusCode = HttpStatus.NOT_FOUND;
    }

    this.logger.debug(`Domain error: ${exception.message}`);

    response.status(statusCode).json({
      statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
