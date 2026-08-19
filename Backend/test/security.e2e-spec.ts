import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { AuditLogEntity } from '../src/audit/entities/audit-log.entity';
import { UserRole, AuditAction } from '../../packages/shared/src/enums';

// DB-backed setup (connection + trigger creation + fixture insert) can
// legitimately take longer than Jest's 5s default, especially over TLS.
jest.setTimeout(30000);

/**
 * SECURITY.md §5 calls these "Required in Jest" — they previously existed
 * only as manual curl commands in CHECKS.md (11a/11b) and as unit tests of
 * RolesGuard in isolation (roles-guard.spec.ts). This file exercises the
 * real HTTP pipeline (route → JwtAuthGuard → RolesGuard → JwtStrategy → DB)
 * end to end, which is the only way to catch a route missing @UseGuards/
 * @Roles() entirely — a pure guard unit test can't see that mistake.
 */
describe('Security (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userRepo: Repository<UserEntity>;
  let auditRepo: Repository<AuditLogEntity>;
  let dataSource: DataSource;
  let testUserId: string;
  let employeeToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // matches main.ts bootstrap() — not implied by AppModule alone
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    auditRepo = moduleFixture.get(getRepositoryToken(AuditLogEntity));
    dataSource = moduleFixture.get(DataSource);

    // Mirrors Database/schemas/002_security_hardening.sql. Idempotent
    // (CREATE OR REPLACE / DROP IF EXISTS), so this is safe to run here even
    // against an already-hardened DB — it just re-asserts the same trigger.
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

    // Throwaway EMPLOYEE account, used only for the privilege-escalation
    // checks below. Deleted in afterAll — never touches real seed users.
    const created = await userRepo.save(
      userRepo.create({
        employeeId: `E2E-TEST-${Date.now()}`,
        firstName: 'E2E',
        lastName: 'TestEmployee',
        email: `e2e-security-test-${Date.now()}@example.invalid`,
        passwordHash: '$2b$12$placeholder.hash.not.used.by.this.test.suite',
        role: UserRole.EMPLOYEE,
        division: 'Test',
        officeOrSection: 'Test',
      }),
    );
    testUserId = created.id;

    employeeToken = jwtService.sign(
      {
        sub: testUserId,
        employeeId: created.employeeId,
        role: UserRole.EMPLOYEE,
        tokenVersion: created.tokenVersion, // 0, matches the freshly created row
      },
      { secret: process.env.JWT_SECRET, expiresIn: '5m' },
    );
  });

  afterAll(async () => {
    if (testUserId) await userRepo.delete(testUserId);
    await app.close();
  });

  // ── 401 — unauthenticated access is rejected ──────────────────────────────
  describe('401 — no token', () => {
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

  // ── 403 — privilege escalation is rejected ────────────────────────────────
  describe('403 — wrong role', () => {
    it('EMPLOYEE hitting the admin/management-only audit log → 403 (CHECKS.md 11b)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    it('EMPLOYEE hitting the IT_PERSONNEL-only asset lifecycle endpoint → 403 (SECURITY.md §5 example)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/assets/00000000-0000-0000-0000-000000000000/lifecycle')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'issued' });
      expect(res.status).toBe(403);
    });
  });

  // ── Audit log immutability (COA compliance) ───────────────────────────────
  describe('Audit log immutability', () => {
    it('has no PUT endpoint for audit logs (append-only at the app level)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/audit/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(404);
    });

    it('has no DELETE endpoint for audit logs (append-only at the app level)', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/v1/audit/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });

    it('rejects UPDATE on audit_logs at the database level (trigger)', async () => {
      const row = await auditRepo.save(
        auditRepo.create({
          userId: testUserId,
          userRole: UserRole.EMPLOYEE,
          action: AuditAction.USER_LOGIN,
          affectedRecordId: testUserId,
          // Identifiable as test residue — this row is never deletable by
          // design (append-only), so it's intentionally left in place.
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
});
