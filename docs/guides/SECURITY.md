# SECURITY.md — AIMRS Security Implementation Guide

> **Read this before implementing any backend module, endpoint, or middleware.**
> This document is the security contract for AIMRS. Every item here is mandatory.
> If CLAUDE.md and this file conflict, this file wins on security matters.

---

## 1. Security Stack — Required Packages

Install these in `Backend/` before writing any feature code:

```bash
npm install helmet cookie-parser joi
npm install @nestjs/throttler
```

> **Note:** `csurf` is deprecated and NOT installed. CSRF protection is handled by `sameSite: 'strict'` on the refresh token cookie, which provides equivalent protection for cookie-based endpoints.

Also install the ESLint security plugin (dev):
```bash
npm install --save-dev eslint-plugin-security
```

And secretlint at the root level:
```bash
npm install --save-dev secretlint @secretlint/secretlint-rule-preset-recommend
```

These are not optional. Every backend module depends on them being globally configured.

---

## 2. Global Bootstrap Configuration (`Backend/src/main.ts`)

This is the exact `main.ts` configuration. Do not deviate from it.

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';           // default import — NOT import * as helmet
import cookieParser from 'cookie-parser'; // default import — NOT import * as cookieParser

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security headers — must be first
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

  // 2. Cookie parser — required for httpOnly refresh tokens
  app.use(cookieParser());

  // 3. CORS — only allow the Next.js frontend, never wildcard
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // 4. Global validation pipe — strips unknown fields, enforces DTOs
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

  // 6. Global exception filter — catches ALL errors, never leaks internals
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 7. Global prefix — controllers add their own /v1/<resource> path
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap(); // void prevents no-floating-promises lint error
```

---

## 3. Rate Limiting (`Backend/src/app.module.ts`)

Apply rate limiting globally. The login endpoint gets a stricter limit.

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,   // 1 minute window
        limit: 100,   // 100 requests per minute per IP (general API)
      },
    ]),
    // ...other modules
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // applies globally to every route
    },
  ],
})
export class AppModule {}
```

Override on the login endpoint specifically:

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 attempts per minute per IP
  async login(@Body() loginDto: LoginDto) {
    // ...
  }
}
```

---

## 4. Authentication Security (`Backend/src/auth/`)

### 4.1 Password Rules

Enforced at the DTO level (rejected before reaching the service):

```typescript
// Backend/src/users/dto/user.dto.ts
@IsString()
@MinLength(12)
@MaxLength(128)
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
  message: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
})
password!: string;
```

Hashing in AuthService (12 rounds minimum):

```typescript
import * as bcrypt from 'bcrypt';
const BCRYPT_ROUNDS = 12;

async hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}
```

### 4.2 Account Lockout

Track failed attempts in the `users` table. Lock after 5 failures. Unlock after 30 minutes automatically.

```typescript
// Required columns on the users table
// failed_login_attempts: integer DEFAULT 0
// locked_until: timestamp nullable

async validateLogin(employeeId: string, password: string) {
  const user = await this.usersService.findByEmployeeId(employeeId);

  if (!user) {
    // Always run bcrypt even on missing user — prevents timing attacks
    await bcrypt.compare(password, '$2b$12$placeholder.hash.to.prevent.timing');
    throw new UnauthorizedException('Invalid credentials');
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new UnauthorizedException('Account temporarily locked. Try again later.');
    // Do NOT reveal the exact unlock time — information leakage
  }

  const isValid = await this.validatePassword(password, user.passwordHash);

  if (!isValid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const updates: Partial<User> = { failedLoginAttempts: attempts };

    if (attempts >= 5) {
      updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      updates.failedLoginAttempts = 0; // reset counter after lockout
    }

    await this.usersService.update(user.id, updates);
    throw new UnauthorizedException('Invalid credentials');
  }

  // Successful login — reset lockout state
  await this.usersService.update(user.id, {
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  return user;
}
```

### 4.3 Concurrent Session Prevention (tokenVersion)

Every successful login increments `tokenVersion` in the `users` table and embeds the new value in the JWT. `JwtStrategy.validate()` rejects any token whose `tokenVersion` doesn't match the DB — killing all previously issued JWTs instantly.

```typescript
// UserEntity column (default 0, increments on each login)
@Column({ default: 0 })
tokenVersion!: number;

// JwtPayload — tokenVersion is required
export interface JwtPayload {
  sub: string;
  employeeId: string;
  role: string;
  tokenVersion: number; // mismatch = session was killed by a newer login
}

// AuthService.login() — bump version on every successful login
const newTokenVersion = user.tokenVersion + 1;
await this.userRepo.update(user.id, {
  failedLoginAttempts: 0,
  lockedUntil: null,
  tokenVersion: newTokenVersion,
});
const payload: JwtPayload = { sub: user.id, employeeId: user.employeeId, role: user.role, tokenVersion: newTokenVersion };

// JwtStrategy.validate() — reject stale tokens
if (user.tokenVersion !== payload.tokenVersion) {
  throw new UnauthorizedException('Session expired. Please log in again.');
}
```

**Effect:** A user logging in on Device B immediately invalidates Device A's access token. Device A's next request gets a 401.

---

### 4.4 JWT Access Token

```typescript
// Access token: short-lived, signed, never stored in localStorage
// Store in memory (React state) on the frontend — NOT localStorage

// In AuthService
generateAccessToken(user: User): string {
  return this.jwtService.sign(
    {
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
      // SVC: Engage — identity assertion for all downstream operations
    },
    {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
      secret: process.env.JWT_SECRET,
    },
  );
}
```

### 4.4 Refresh Token (httpOnly Cookie)

```typescript
// Refresh tokens: long-lived, stored as bcrypt hash in DB, single-use
// Transmitted via httpOnly cookie ONLY — never in response body

import { randomUUID } from 'crypto'; // Node built-in — do NOT use the 'uuid' npm package (ESM incompatible with Jest)

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async generateRefreshToken(userId: string, res: Response): Promise<void> {
  const rawToken = randomUUID(); // random, not JWT
  const hashedToken = await bcrypt.hash(rawToken, 10);

  // Store hashed version in DB
  await this.userRepo.update(userId, {
    refreshTokenHash: hashedToken,
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  // Cookie value carries userId prefix so /auth/refresh can look up user
  // without needing a valid (potentially expired) access token
  res.cookie('refresh_token', `${userId}:${rawToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/v1/auth/refresh', // cookie only sent to this URL path
  });
}

async rotateRefreshToken(cookieValue: string, ipAddress: string, res: Response) {
  // Split on first colon: "userId:rawToken"
  const colonIdx = cookieValue.indexOf(':');
  if (colonIdx === -1) throw new UnauthorizedException();

  const userId = cookieValue.substring(0, colonIdx);
  const rawToken = cookieValue.substring(colonIdx + 1);

  const user = await this.userRepo
    .createQueryBuilder('user')
    .addSelect('user.refreshTokenHash')
    .where('user.id = :userId', { userId })
    .getOne();

  if (!user?.refreshTokenHash || !user.refreshTokenExpiresAt) {
    throw new UnauthorizedException();
  }

  if (user.refreshTokenExpiresAt < new Date()) throw new UnauthorizedException();

  const isValid = await bcrypt.compare(rawToken, user.refreshTokenHash);
  if (!isValid) {
    // Token reuse detected — invalidate session entirely
    await this.userRepo.update(userId, { refreshTokenHash: null, refreshTokenExpiresAt: null });
    throw new UnauthorizedException('Session invalidated. Please log in again.');
  }

  // Single-use: rotate immediately
  await this.generateRefreshToken(userId, res);
  return { accessToken: this.jwtService.sign({ sub: user.id, role: user.role }) };
}

async logout(userId: string, userRole: UserRole, ipAddress: string, res: Response): Promise<void> {
  await this.userRepo.update(userId, {
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
  });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}
```

---

## 5. RBAC Guards (`Backend/src/auth/guards/`)

Every protected endpoint MUST have both `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`. No exceptions.

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return false; // deny by default if no @Roles() decorator

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}

// Usage on every protected endpoint:
@Get('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
async findAll() {
  // ...
}
```

### Privilege Escalation Test (Required in Jest)

```typescript
it('should return 403 when Employee tries to access asset lifecycle endpoint', async () => {
  const employeeToken = generateTestToken(UserRole.EMPLOYEE);
  const res = await request(app.getHttpServer())
    .patch('/api/v1/assets/1/lifecycle')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({ status: 'issued' });

  expect(res.status).toBe(403);
});
```

---

## 6. Database Security

### 6.1 No Raw SQL — Zero Exceptions

```typescript
// WRONG — never do this
const assets = await this.dataSource.query(
  `SELECT * FROM assets WHERE division = '${division}'`
);

// CORRECT — always use TypeORM QueryBuilder or repository
const assets = await this.assetRepository
  .createQueryBuilder('asset')
  .where('asset.division = :division', { division })
  .getMany();

// ALSO CORRECT — repository method
const asset = await this.assetRepository.findOne({
  where: { propertyNumber }
});
```

### 6.2 Audit Log Table Constraints

The `audit_logs` table must have a PostgreSQL-level constraint blocking all modifications.
Add this to the schema migration:

```sql
-- Revoke UPDATE and DELETE on audit_logs at the database level
-- This is in addition to the application-level restriction
-- COA compliance: audit logs are permanent and immutable

REVOKE UPDATE, DELETE ON audit_logs FROM aimrs_app_user;

-- Also create a trigger to prevent any future UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be modified or deleted. COA compliance requirement.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

### 6.3 Sensitive Fields in Logs

```typescript
// NEVER log these fields — add to NestJS logger config
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'refreshTokenHash',
  'jwtSecret',
  'token',
  'authorization',
];

// When logging request/response objects, strip sensitive fields first
function sanitizeForLog(obj: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) =>
      !SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))
    )
  );
}
```

---

## 7. Input Validation Rules

Every NestJS DTO must use `class-validator` decorators. No raw request body access.

```typescript
// Example: Create Asset DTO
import {
  IsString, IsNotEmpty, IsNumber, IsEnum,
  IsDateString, MaxLength, Min, IsOptional
} from 'class-validator';
import { AssetCondition, AssetClass, AssetType } from '../enums';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemDescription: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serialNumber: string;

  @IsNumber()
  @Min(0)
  acquisitionCost: number;

  @IsDateString()
  acquisitionDate: string;

  @IsEnum(AssetCondition)
  condition: AssetCondition;

  @IsEnum(AssetClass)
  assetClass: AssetClass;

  @IsEnum(AssetType)
  assetType: AssetType;

  // Add @MaxLength to every string field
  // Add @Min(0) to every number field
  // Use @IsEnum() for every field with a fixed set of values
}
```

### QR Code Scan Input — Treat as Untrusted

```typescript
// QR scan endpoint — extra validation required
@Post('qr-scan')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.IT_PERSONNEL)
async scanQr(@Body() body: { qrValue: string }) {
  // Sanitize: QR values should only be UUIDs or a defined format
  const QR_PATTERN = /^[A-Z]{3}-[0-9]{4}-[A-Z0-9]{8}$/; // match your QR format

  if (!QR_PATTERN.test(body.qrValue)) {
    throw new BadRequestException('Invalid QR code format');
    // SVC: Deliver and Support — reject malformed scan inputs
  }

  return this.assetService.findByQrCode(body.qrValue);
}
```

---

## 8. Error Response Standard

Every error response must follow the envelope format. Never expose internal details.

```typescript
// Global exception filter — registered in main.ts via app.useGlobalFilters()
// Backend/src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the real error internally (never send to client)
    this.logger.error(
      `${request.method} ${request.url} — ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // Send only safe generic message to client
    const safeMessages: Record<number, string> = {
      400: 'Invalid request data.',
      401: 'Authentication required.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      429: 'Too many requests. Please wait before trying again.',
      500: 'An unexpected error occurred. Please contact your system administrator.',
    };

    response.status(status).json({
      data: null,
      message: safeMessages[status] ?? 'An error occurred.',
      statusCode: status,
      // Never include: stack trace, query text, table names, file paths
    });
  }
}
```

Already registered in `main.ts` via `app.useGlobalFilters(new GlobalExceptionFilter())`.

---

## 9. Audit Trail Logging (Every State Change)

Every action that modifies data must create an audit log entry. This is not optional.

```typescript
// Backend/src/audit/audit.service.ts

export interface AuditLogEntry {
  userId: string;
  userRole: UserRole;
  actionType: AuditAction;
  recordId: string;
  recordTable: string;
  ipAddress: string;
  metadata?: Record<string, unknown>; // before/after state, optional
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<void> {
    // INSERT only — never UPDATE or DELETE
    // SVC: Improve — every transaction creates an immutable record
    await this.auditLogRepository.insert({
      ...entry,
      createdAt: new Date(),
    });
  }
}

// Required audit events — log ALL of these:
export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_LOCKED = 'USER_LOCKED',
  ASSET_CREATED = 'ASSET_CREATED',
  ASSET_STATUS_CHANGED = 'ASSET_STATUS_CHANGED',
  ASSET_ISSUED = 'ASSET_ISSUED',
  ASSET_RETURNED = 'ASSET_RETURNED',
  ASSET_TRANSFERRED = 'ASSET_TRANSFERRED',
  ASSET_FLAGGED_DISPOSAL = 'ASSET_FLAGGED_DISPOSAL',
  REQUISITION_SUBMITTED = 'REQUISITION_SUBMITTED',
  REQUISITION_APPROVED = 'REQUISITION_APPROVED',
  REQUISITION_REJECTED = 'REQUISITION_REJECTED',
  REQUISITION_FULFILLED = 'REQUISITION_FULFILLED',
  USER_CREATED = 'USER_CREATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  FORM_GENERATED = 'FORM_GENERATED',
}
```

### How to Extract IP from Request

```typescript
// Helper — use in every controller that logs audit events
function getClientIp(request: Request): string {
  return (
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    request.socket.remoteAddress ??
    'unknown'
  );
}
```

---

## 10. Frontend Security (`Frontend/`)

### 10.1 Token Storage

```typescript
// CORRECT — access token in memory only (React state or context)
// Never in localStorage or sessionStorage

// In auth context:
const [accessToken, setAccessToken] = useState<string | null>(null);

// On login response:
setAccessToken(response.data.accessToken); // store in memory

// On page refresh — use the httpOnly cookie refresh token to silently re-issue
// Call /api/v1/auth/refresh on app load if no accessToken in state
```

### 10.2 Axios Instance with Token Injection

```typescript
// Frontend/lib/api-client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // sends httpOnly cookies automatically
});

// Attach access token from memory on every request
apiClient.interceptors.request.use((config) => {
  const token = getAccessTokenFromMemory(); // from auth context
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken(); // calls /auth/refresh
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  },
);
```

### 10.3 Role-Based Route Protection (Next.js)

```typescript
// Frontend/middleware.ts — Next.js middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_ROUTES: Record<string, string[]> = {
  '/employee': ['EMPLOYEE', 'SUPERVISOR', 'IT_PERSONNEL', 'SYSTEM_ADMIN'],
  '/supervisor': ['SUPERVISOR', 'SYSTEM_ADMIN'],
  '/it-personnel': ['IT_PERSONNEL', 'SYSTEM_ADMIN'],
  '/admin': ['SYSTEM_ADMIN'],
  '/management': ['MANAGEMENT', 'SYSTEM_ADMIN'],
};

export function middleware(request: NextRequest) {
  // Note: frontend route protection is UX only
  // All real enforcement happens at the NestJS API level
  // This just prevents accidental navigation — not a security control
  const userRole = request.cookies.get('user_role')?.value;
  const path = request.nextUrl.pathname;

  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (path.startsWith(route) && userRole && !allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}
```

---

## 11. Environment Variables Reference

All required environment variables. Never commit `.env` files.

```bash
# Backend/.env

# Database
DATABASE_URL=postgresql://user:password@host:5432/aimrs_db

# JWT — must be at least 32 random characters (Joi validation enforces this at startup)
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<minimum-64-character-random-string>
JWT_EXPIRES_IN=8h

# CORS
ALLOWED_ORIGIN=http://localhost:3000  # Next.js URL

# Environment
NODE_ENV=development  # set to 'production' on CICC servers

# Supabase (dev/test only — remove before production deployment)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Rate limiting (optional override)
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# Frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 12. Security Acceptance Criteria (Every User Story)

Add these checkboxes to every sprint user story before marking it done.
Claude Code must verify all of these before considering a feature complete:

```
Security Checklist — required for every story:

[ ] @UseGuards(JwtAuthGuard, RolesGuard) + @Roles() on every new endpoint
[ ] Audit log entry created for every state-changing action
[ ] DTO with class-validator decorators on every request body
[ ] No raw SQL — TypeORM QueryBuilder or repository methods only
[ ] Error response uses GlobalExceptionFilter envelope format
[ ] Sensitive fields (password, tokens) never appear in logs or responses
[ ] Rate limiting applied (login endpoint gets stricter @Throttle override)
[ ] New DB table with sensitive data: REVOKE UPDATE, DELETE from app user
[ ] Jest test: wrong role returns 403 on new endpoint
[ ] Jest test: audit log entry is created for state-changing action
[ ] npm run lint — zero ESLint security plugin errors before merge
[ ] npm run secretlint — zero hardcoded credentials in committed files
[ ] npm run audit:check — zero HIGH/CRITICAL CVEs in dependencies before deploy
```

---

## 13. OWASP ASVS Mapping

These are the OWASP ASVS Level 1 controls and how AIMRS implements each.
Reference this in your capstone testing chapter.

| OWASP ASVS Control | AIMRS Implementation |
|---|---|
| V2.1 — Password security | bcrypt 12 rounds, enforced in AuthService |
| V2.2 — General authenticator security | Account lockout after 5 attempts, 30-min unlock |
| V2.3 — Authenticator lifecycle | JWT 8h expiry, refresh token rotation |
| V3.3 — Token-based session management | Access token in memory, refresh in httpOnly cookie |
| V3.5 — Token-based stateless sessions | JWT signed with strong secret, validated on every request |
| V4.1 — General access control | RBAC via RolesGuard on all endpoints, deny-by-default |
| V4.2 — Operation-level access control | @Roles() decorator on every protected endpoint |
| V5.1 — Input validation | class-validator DTOs, whitelist: true in ValidationPipe |
| V5.3 — Output encoding | GlobalExceptionFilter strips internal details |
| V7.1 — Log content | AuditService logs all state changes, sensitive fields stripped |
| V7.3 — Log protection | audit_logs: append-only, DB-level trigger prevents modification |
| V8.1 — General data protection | Data minimization: only required fields collected |
| V9.1 — Communications security | HTTPS enforced in production (CICC-managed TLS) |
| V13.1 — Generic web service security | Helmet headers, CORS restricted to frontend origin |
| V13.4 — GraphQL / REST | Global ValidationPipe, response envelope, no stack traces |

---

*This file is the security implementation contract for AIMRS.
Always read it before implementing any backend feature.
If a feature cannot be implemented while satisfying all items in Section 12, stop and raise it with the team before proceeding.*
