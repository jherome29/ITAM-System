import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { applyRequestPipeline } from './common/app-pipeline';
import { applyDefaultTimeZone } from './common/app-time-zone';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { trustedClientIp } from './common/trusted-client-ip';

// Before anything reads the clock: a container defaults to UTC, which shifts the
// daily 7:00 jobs and the dashboards' "today" / "this month" by 8 hours.
applyDefaultTimeZone();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 0. Reverse-proxy trust. In production TLS terminates at CICC IT's proxy, so
  // without this every request's `req.ip` is the proxy's address — and audit
  // entries (CLAUDE.md §8.3 requires the client IP) would all record the same
  // internal hop. Opt-in via env so a directly-exposed dev/test server cannot be
  // fed a spoofed X-Forwarded-For:
  //   TRUST_PROXY unset | 'false' | '0'  → no trust (req.ip = socket address)
  //   TRUST_PROXY='1' (or any integer N) → trust N proxy hops  [typical prod]
  //   TRUST_PROXY=<preset | CIDR list>   → passed to Express verbatim
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false' && trustProxy !== '0') {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  // Behind the UAT password gate the visitor's address arrives in a header the gate signs with a shared
  // secret (src/common/trusted-client-ip.ts); a request without the secret is left exactly as it was.
  const clientIpSecret = process.env.CLIENT_IP_SECRET;
  if (clientIpSecret && clientIpSecret.length >= 24) {
    app.use(trustedClientIp(clientIpSecret));
  }

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
    // The browser may only read these on a cross-origin download: the form's
    // number and file name.
    exposedHeaders: ['Content-Disposition', 'X-Document-Number'],
  });

  // 4. Request pipeline — validation, response envelope, exception filter,
  // /api prefix. Shared with the e2e suite (test/create-test-app.ts).
  applyRequestPipeline(app);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
