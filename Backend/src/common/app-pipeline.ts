import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { GlobalExceptionFilter } from './filters/http-exception.filter';

/**
 * The request pipeline every route runs through — shared by main.ts and the
 * e2e suite (test/create-test-app.ts) so tests exercise the same DTO rules,
 * response envelope and error shape as production. Transport concerns (proxy
 * trust, helmet, CORS, cookies, listen) stay in main.ts.
 */
export function applyRequestPipeline(app: INestApplication): void {
  // Global validation pipe — strips unknown fields, enforces DTOs (SECURITY.md §7)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global response envelope — { statusCode, message, data }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global exception filter — catches ALL errors, never leaks internals (SECURITY.md §8)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global API prefix
  app.setGlobalPrefix('api');
}
