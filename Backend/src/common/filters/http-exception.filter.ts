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
  429: 'Too many requests. Please wait before trying again.',
  500: 'An unexpected error occurred. Please contact your system administrator.',
};

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
