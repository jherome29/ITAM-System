import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security headers — must be applied first (SECURITY.md §2)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Cookie parser — required for refresh token httpOnly cookies
  app.use(cookieParser());

  // 3. CORS — restrict to frontend origin only, never wildcard (SECURITY.md §2)
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // 4. Global validation pipe — strips unknown fields, enforces DTOs (SECURITY.md §7)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 5. Global response envelope — { statusCode, message, data }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // 6. Global exception filter — catches ALL errors, never leaks internals (SECURITY.md §8)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 7. Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
