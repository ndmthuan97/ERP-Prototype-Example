// =============================================================================
// DOMAIN EXCEPTION FILTER — Map domain errors → HTTP status codes
// =============================================================================
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  InvalidCredentialsError,
  UserNotFoundError,
  DuplicateEmailError,
  InactiveUserError,
} from '../domain/errors.js';

@Catch(InvalidCredentialsError, UserNotFoundError, DuplicateEmailError, InactiveUserError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof InvalidCredentialsError) {
      status = HttpStatus.UNAUTHORIZED;
    } else if (exception instanceof UserNotFoundError) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof DuplicateEmailError) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof InactiveUserError) {
      status = HttpStatus.FORBIDDEN;
    }

    this.logger.debug(`Domain error: ${exception.message}`);

    response.status(status).json({
      statusCode: status,
      error: exception.constructor.name,
      message: exception.message,
    });
  }
}
