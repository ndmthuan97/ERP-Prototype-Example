// =============================================================================
// ZOD EXCEPTION FILTER — Map ZodError to HTTP 400 (global)
// =============================================================================

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodExceptionFilter.name);

  catch(exception: ZodError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const issues = exception.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    this.logger.debug(`Validation failed: ${JSON.stringify(issues)}`);

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Bad Request",
      message: "Validation failed",
      issues,
    });
  }
}
