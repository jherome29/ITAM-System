import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

/**
 * ResponseInterceptor — wraps ALL successful responses in the standard envelope:
 *   { statusCode, message, data }
 *
 * Per CLAUDE.md section 16:
 *   "API style: RESTful, with consistent response envelopes: { data, message, statusCode }"
 *
 * Applied globally in main.ts via app.useGlobalInterceptors().
 * Error responses are handled separately by the HttpExceptionFilter.
 *
 * SVC: Deliver and Support — consistent, predictable API contract
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode: number = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // If the service already returns an envelope (e.g. { message, data }),
        // hoist the message and keep data clean
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data
        ) {
          return {
            statusCode,
            message: (data as { message: string }).message,
            data: (data as { data: T }).data,
          };
        }

        return {
          statusCode,
          message: 'Success',
          data: (data ?? null) as T,
        };
      }),
    );
  }
}
