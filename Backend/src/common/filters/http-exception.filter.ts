import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sanitizeForLog } from '../utils/sanitize-log.util';

// Safe client-facing messages — never expose internals (SECURITY.md §8)
const SAFE_MESSAGES: Record<number, string> = {
  400: 'Invalid request data.',
  401: 'Authentication required.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  413: 'The request is too large.',
  429: 'Too many requests. Please wait before trying again.',
  500: 'An unexpected error occurred. Please contact your system administrator.',
};

/**
 * Postgres errors that mean the caller sent something the database cannot take. DTOs check field
 * sizes first (common/field-limits.ts); this answers the ones that slip past, and the unique
 * constraints (a property number or employee ID that already exists), with a 4xx instead of a
 * 500. The messages never name the column, the constraint or the table (SECURITY.md §8).
 */
const DATABASE_CLIENT_ERRORS: Record<
  string,
  { status: number; message: string }
> = {
  '22001': {
    status: 400,
    message: 'A value is longer than the system allows.',
  },
  '22003': {
    status: 400,
    message: 'A number is outside the range the system allows.',
  },
  '23505': {
    status: 409,
    message: 'A record with one of these values already exists.',
  },
};

/** The five-character Postgres error code, wherever the driver or TypeORM left it. */
function databaseErrorCode(exception: unknown): string | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const direct = (exception as { code?: unknown }).code;
  const wrapped = (exception as { driverError?: { code?: unknown } })
    .driverError?.code;
  const code = typeof direct === 'string' ? direct : wrapped;
  return typeof code === 'string' ? code : undefined;
}

/**
 * A client error raised below Nest, by the body parser: 413 for a body over the limit, 400 for
 * one that is not JSON. These are not HttpExceptions, so they used to fall through to the 500.
 * Only a 4xx the library marks as safe to show (`expose`) is trusted.
 */
function bodyParserStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
    ? status
    : undefined;
}

/**
 * GlobalExceptionFilter — catches ALL exceptions (HTTP and non-HTTP).
 * Non-HTTP errors (TypeORM, unexpected throws) always return 500 with safe message.
 *
 * Per SECURITY.md §8 and CLAUDE.md §16:
 *   - Never expose stack traces, query text, table names, or file paths to clients
 *   - Always log full error server-side for debugging
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let clientMessage: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // For 4xx errors from validation or business logic, pass message through
      if (typeof exceptionResponse === 'string') {
        clientMessage = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const raw = (exceptionResponse as { message: string | string[] })
          .message;
        clientMessage = Array.isArray(raw) ? raw.join('; ') : raw;
      } else {
        clientMessage = SAFE_MESSAGES[statusCode] ?? 'An error occurred.';
      }
    } else if (bodyParserStatus(exception) !== undefined) {
      statusCode = bodyParserStatus(exception) as number;
      clientMessage = SAFE_MESSAGES[statusCode] ?? SAFE_MESSAGES[400];
    } else if (DATABASE_CLIENT_ERRORS[databaseErrorCode(exception) ?? '']) {
      ({ status: statusCode, message: clientMessage } =
        DATABASE_CLIENT_ERRORS[databaseErrorCode(exception) as string]);
    } else {
      // Non-HTTP exception (database error, unhandled throw, etc.)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      clientMessage = SAFE_MESSAGES[500];
    }

    // Log all 5xx errors internally with full detail — never sent to client
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
        { headers: sanitizeForLog(request.headers) },
      );
    }

    response.status(statusCode).json({
      statusCode,
      message: clientMessage,
      data: null,
    });
  }
}
