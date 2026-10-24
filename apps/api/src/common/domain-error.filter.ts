import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { NotFoundError, ValidationError } from './domain-errors.js';

// SQLSTATE codes are standard SQL, not PostgreSQL-specific.
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

function sqlState(error: QueryFailedError): string | undefined {
  const code: unknown = (error.driverError as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

@Catch(NotFoundError, ValidationError, QueryFailedError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof NotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({ message: error.message });
      return;
    }
    if (error instanceof ValidationError) {
      response.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid request', errors: error.errors });
      return;
    }

    const state = error instanceof QueryFailedError ? sqlState(error) : undefined;
    if (state === UNIQUE_VIOLATION) {
      response.status(HttpStatus.CONFLICT).json({ message: 'Already exists' });
      return;
    }
    // Either the body references a row that does not exist, or a delete hits a
    // row still referenced elsewhere (a thread size used by equipment).
    if (state === FOREIGN_KEY_VIOLATION) {
      response.status(HttpStatus.CONFLICT).json({ message: 'Referenced row missing or still in use' });
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
}
