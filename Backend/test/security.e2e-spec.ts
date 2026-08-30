import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { AuditLogEntity } from '../src/audit/entities/audit-log.entity';
import { AuthController } from '../src/auth/auth.controller';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { UserRole, AuditAction } from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// DB-backed setup (connection + trigger creation + fixture insert) can
// legitimately take longer than Jest's 5s default, especially over TLS.
jest.setTimeout(30000);

/**
 * PHASE-5-TESTING.md Step 5.1 — the formal security suite. Exercises the real
 * HTTP pipeline (route → JwtAuthGuard → RolesGuard → JwtStrategy → ValidationPipe
 * → handler) end to end, which is the only way to catch a route missing
 * @UseGuards/@Roles() entirely — a pure guard unit test can't see that mistake.
 *
 * The 8 scenarios from Step 5.1:
 *   1 privilege escalation · 2 no token · 3 tampered JWT · 4 account lockout
 *   5 rate limiting · 6 audit-log immutability · 7 input validation / SQLi
 *   8 no sensitive fields in responses
 *
 * Login-throttle note: @Throttle on /auth/login is 10 requests / minute / IP,
 * and supertest shares one IP across every e2e file. This suite keeps its total
 * login POSTs to 4 (1 success + 1 lockout + 2 validation) and asserts the
 * throttle *config* rather than tripping it live, so it never poisons the
 * shared window for the files that run after it.
 */
describe('Security (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userRepo: Repository<UserEntity>;
  let auditRepo: Repository<AuditLogEntity>;
  let dataSource: DataSource;

  // throwaway fixtures — all deleted in afterAll, never touch real seed users
  let employeeId: string;
  let supervisorId: string;
  let adminId: string;
  let lockUserId: string;
  let adminEmail: string;
  let lockEmail: string;
  let employeeToken: string;
  let supervisorToken: string;
  let adminToken: string;

  const KNOWN_PASSWORD = 'S3curity@E2E!Pass'; // real hash for the two login-flow users

  const signToken = (id: string, empId: string, role: UserRole) =>
    jwtService.sign(
      { sub: id, employeeId: empId, role, tokenVersion: 0 },
      { secret: process.env.JWT_SECRET, expiresIn: '5m' },
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror src/main.ts bootstrap() so the e2e pipeline matches production:
    // global prefix, the strict ValidationPipe (scenario 7 depends on it), the
    // response envelope, and the exception filter.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    auditRepo = moduleFixture.get(getRepositoryToken(AuditLogEntity));
    dataSource = moduleFixture.get(DataSource);

    // Mirrors Database/schemas/002_security_hardening.sql. Idempotent
    // (CREATE OR REPLACE / DROP IF EXISTS), so safe to run against an
    // already-hardened DB — it just re-asserts the same trigger.
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit log records cannot be modified or deleted. COA compliance requirement.';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await dataSource.query(
      `DROP TRIGGER IF EXISTS audit_log_immutability ON audit_logs;`,
    );
    await dataSource.query(`
      CREATE TRIGGER audit_log_immutability
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    const stamp = Date.now();
    const placeholder = '$2b$12$placeholder.hash.not.used.by.this.test.suite';
    const knownHash = await bcrypt.hash(KNOWN_PASSWORD, BCRYPT_ROUNDS);

    const mk = (over: Partial<UserEntity>) =>
      userRepo.save(
        userRepo.create({
          firstName: 'E2E',
          lastName: 'Security',
          division: 'Test',
          officeOrSection: 'Test',
          passwordHash: placeholder,
          ...over,
        }),
      );

    const emp = await mk({
      employeeId: `E2E-SEC-EMP-${stamp}`,
      email: `e2e-sec-emp-${stamp}@example.invalid`,
      role: UserRole.EMPLOYEE,
    });
    const sup = await mk({
      employeeId: `E2E-SEC-SUP-${stamp}`,
      email: `e2e-sec-sup-${stamp}@example.invalid`,
      role: UserRole.SUPERVISOR,
    });
    const adm = await mk({
      employeeId: `E2E-SEC-ADM-${stamp}`,
      email: `e2e-sec-adm-${stamp}@example.invalid`,
      role: UserRole.SYSTEM_ADMIN,
      passwordHash: knownHash,
    });
    // Seeded well past any reasonable lockout threshold, so a single bad login
    // deterministically crosses it (attempts++ >= maxLoginAttempts) regardless
    // of the configured value — and keeps the suite's total login POSTs low
    // (see the throttle note above).
    const lock = await mk({
      employeeId: `E2E-SEC-LOCK-${stamp}`,
      email: `e2e-sec-lock-${stamp}@example.invalid`,
      role: UserRole.EMPLOYEE,
      passwordHash: knownHash,
      failedLoginAttempts: 20,
    });

    employeeId = emp.id;
    supervisorId = sup.id;
    adminId = adm.id;
    lockUserId = lock.id;
    adminEmail = adm.email;
    lockEmail = lock.email;

    employeeToken = signToken(emp.id, emp.employeeId, UserRole.EMPLOYEE);
    supervisorToken = signToken(sup.id, sup.employeeId, UserRole.SUPERVISOR);
    adminToken = signToken(adm.id, adm.employeeId, UserRole.SYSTEM_ADMIN);
  });

  afterAll(async () => {
    for (const id of [employeeId, supervisorId, adminId, lockUserId]) {
      if (id) await userRepo.delete(id);
    }
    if (app) await app.close();
  });

  // ── Scenario 2 — unauthenticated access is rejected ───────────────────────
  describe('2 — no token → 401', () => {
    const protectedGetRoutes = [
      '/api/v1/assets',
      '/api/v1/requisitions',
      '/api/v1/audit',
      '/api/v1/users',
      '/api/v1/notifications',
      '/api/v1/reports',
    ];

    test.each(protectedGetRoutes)(
      'GET %s → 401 without a token',
      async (url) => {
        const res = await request(app.getHttpServer()).get(url);
        expect(res.status).toBe(401);
      },
    );
  });

  // ── Scenario 1 — privilege escalation is rejected ─────────────────────────
  describe('1 — privilege escalation → 403', () => {
    it('EMPLOYEE hitting the admin/management-only audit log → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    it('EMPLOYEE hitting the IT_PERSONNEL-only asset lifecycle endpoint → 403', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/assets/00000000-0000-0000-0000-000000000000/lifecycle')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'issued' });
      expect(res.status).toBe(403);
    });

    it('SUPERVISOR hitting the SYSTEM_ADMIN-only user-create endpoint → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          employeeId: 'X',
          firstName: 'X',
          lastName: 'X',
          email: 'x@example.invalid',
          password: 'Whatever@Pass123',
          role: 'employee',
          division: 'X',
          officeOrSection: 'X',
        });
      expect(res.status).toBe(403);
    });

    it('a JWT that claims role=system_admin for an EMPLOYEE row is still 403 (role is read from the DB, not the token)', async () => {
      const forgedRoleToken = signToken(
        employeeId,
        'E2E-SEC-EMP-forged',
        UserRole.SYSTEM_ADMIN,
      );
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${forgedRoleToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Scenario 3 — tampered JWT is rejected ─────────────────────────────────
  describe('3 — tampered JWT → 401', () => {
    it('flipping one character of the signature → 401', async () => {
      const parts = employeeToken.split('.');
      const sig = parts[2];
      parts[2] = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${parts.join('.')}`);
      expect(res.status).toBe(401);
    });

    it('a garbage string in place of a token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/assets')
        .set('Authorization', 'Bearer not.a.real.jwt');
      expect(res.status).toBe(401);
    });
  });

  // ── Scenario 8 — responses never carry credential fields ──────────────────
  describe('8 — no sensitive fields in responses', () => {
    const forbidden = ['passwordHash', 'refreshTokenHash', 'password'];
    const assertClean = (body: unknown) => {
      const json = JSON.stringify(body);
      for (const key of forbidden) {
        expect(json).not.toContain(`"${key}"`);
      }
    };

    // GET first — a successful login (next test) bumps tokenVersion and would
    // invalidate the pre-signed adminToken this check relies on.
    it('GET /api/v1/users (admin) exposes no credential fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      assertClean(res.body);
    });

    it('login response contains no credential fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: adminEmail, password: KNOWN_PASSWORD });
      expect([200, 201]).toContain(res.status);
      assertClean(res.body);
    });
  });

  // ── Scenarios 4 + 5 — brute-force protection ──────────────────────────────
  describe('4/5 — brute-force protection', () => {
    it('4 — a bad password at the lockout threshold locks the account, with a message that reveals no timing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: lockEmail, password: 'wrong-password' });

      expect(res.status).toBe(403);
      const message = String(res.body?.message ?? '');
      expect(message.toLowerCase()).toContain('locked');
      // SECURITY.md §4.2 — do not reveal the unlock time
      expect(message).not.toMatch(/\d/);
      expect(message.toLowerCase()).not.toMatch(/minute|second|hour|until/);
    });

    it('5 — the login route carries a throttle limit far below the global 60/min', () => {
      // @Throttle({ default: { ttl: 60000, limit: 10 } }) on AuthController.login
      // stores the raw limit under the "THROTTLER:LIMITdefault" metadata key on
      // the method function. Asserting the config (not tripping a live 429) keeps
      // this suite from poisoning the shared login-throttle window for the e2e
      // files that run after it.
      const target = AuthController.prototype.login as object;
      const limitKey = Reflect.getMetadataKeys(target)
        .map(String)
        .find((k) => /throttler/i.test(k) && /limit/i.test(k));
      expect(limitKey).toBeDefined();
      const limit = Reflect.getMetadata(limitKey, target) as number;
      expect(limit).toBe(10);
      expect(limit).toBeLessThan(60);
    });
  });

  // ── Scenario 6 — audit log immutability (COA compliance) ──────────────────
  describe('6 — audit log immutability', () => {
    it('has no PUT endpoint for audit logs', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/audit/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(404);
    });

    it('has no DELETE endpoint for audit logs', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/v1/audit/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });

    it('rejects UPDATE on audit_logs at the database level (trigger)', async () => {
      const row = await auditRepo.save(
        auditRepo.create({
          userId: employeeId,
          userRole: UserRole.EMPLOYEE,
          action: AuditAction.USER_LOGIN,
          affectedRecordId: employeeId,
          affectedRecordType: 'e2e_test_immutability_check',
          ipAddress: '127.0.0.1',
        }),
      );

      await expect(
        dataSource.query(
          'UPDATE audit_logs SET ip_address = $1 WHERE id = $2',
          ['0.0.0.0', row.id],
        ),
      ).rejects.toThrow(/cannot be modified or deleted/i);
    });
  });

  // ── Scenario 7 — input validation / injection ─────────────────────────────
  describe('7 — input validation', () => {
    it('a body with an unknown field → 400 (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          emailOrEmployeeId: 'someone@example.invalid',
          password: 'whatever',
          hackerField: "'; DROP TABLE users; --",
        });
      expect(res.status).toBe(400);
    });

    it('a SQL-injection string in a valid field is bound safely — 401, never 200 or 500', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: "' OR 1=1 --", password: "' OR '1'='1" });
      expect(res.status).toBe(401);
      expect(res.body?.data?.accessToken).toBeUndefined();
    });
  });
});
