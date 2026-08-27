import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { UserRole } from '../../packages/shared/src/enums';

// DB-backed setup (connection + fixture insert) can legitimately take longer
// than Jest's 5s default, especially over TLS.
jest.setTimeout(30000);

/**
 * RBAC coverage for POST /api/v1/notifications/run-checks (SchedulerController).
 *
 * Exercises the real HTTP pipeline (route → JwtAuthGuard → RolesGuard →
 * JwtStrategy → DB) so a route missing @UseGuards/@Roles() would be caught.
 * Watchers are stubbed (return 0) at this point in the plan, so the summary
 * body is asserted structurally, not by value.
 *
 * Tokens are minted directly with JwtService (mirrors security.e2e-spec.ts)
 * rather than via POST /auth/login — the e2e Postgres is schema-only with no
 * seed users, so there is nothing to log in as. One token is signed per user.
 */
describe('Notifications scheduler (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userRepo: Repository<UserEntity>;

  let adminId: string;
  let employeeId: string;
  let adminToken: string;
  let employeeToken: string;

  const RUN_CHECKS = '/api/v1/notifications/run-checks';

  const signFor = (user: UserEntity): string =>
    jwtService.sign(
      {
        sub: user.id,
        employeeId: user.employeeId,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      { secret: process.env.JWT_SECRET, expiresIn: '5m' },
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // matches main.ts bootstrap() — not implied by AppModule alone
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));

    const stamp = Date.now();

    const admin = await userRepo.save(
      userRepo.create({
        employeeId: `E2E-SCHED-ADMIN-${stamp}`,
        firstName: 'E2E',
        lastName: 'SchedAdmin',
        email: `e2e-sched-admin-${stamp}@example.invalid`,
        passwordHash: '$2b$12$placeholder.hash.not.used.by.this.test.suite',
        role: UserRole.SYSTEM_ADMIN,
        division: 'Test',
        officeOrSection: 'Test',
      }),
    );
    adminId = admin.id;
    adminToken = signFor(admin);

    const employee = await userRepo.save(
      userRepo.create({
        employeeId: `E2E-SCHED-EMP-${stamp}`,
        firstName: 'E2E',
        lastName: 'SchedEmployee',
        email: `e2e-sched-emp-${stamp}@example.invalid`,
        passwordHash: '$2b$12$placeholder.hash.not.used.by.this.test.suite',
        role: UserRole.EMPLOYEE,
        division: 'Test',
        officeOrSection: 'Test',
      }),
    );
    employeeId = employee.id;
    employeeToken = signFor(employee);
  });

  afterAll(async () => {
    if (adminId) await userRepo.delete(adminId);
    if (employeeId) await userRepo.delete(employeeId);
    await app.close();
  });

  it('401s without a token', async () => {
    await request(app.getHttpServer()).post(RUN_CHECKS).expect(401);
  });

  it('403s for a non-admin role (EMPLOYEE)', async () => {
    await request(app.getHttpServer())
      .post(RUN_CHECKS)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('200 + a four-key numeric summary for SYSTEM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .post(RUN_CHECKS)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toEqual(
      expect.objectContaining({
        slaBreaches: expect.any(Number),
        pendingNudges: expect.any(Number),
        overdueReturns: expect.any(Number),
        lowStock: expect.any(Number),
      }),
    );
  });

  it('does not shadow the existing GET /notifications route on the shared path', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
  });
});
