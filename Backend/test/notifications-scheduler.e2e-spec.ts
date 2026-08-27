import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { RequisitionEntity } from '../src/requisitions/entities/requisition.entity';
import { NotificationEntity } from '../src/notifications/entities/notification.entity';
import {
  UserRole,
  RequisitionStatus,
  RequisitionType,
} from '../../packages/shared/src/enums';

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

  let adminRowId: string;
  let employeeRowId: string;
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
    adminRowId = admin.id;
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
    employeeRowId = employee.id;
    employeeToken = signFor(employee);
  });

  afterAll(async () => {
    if (adminRowId) await userRepo.delete(adminRowId);
    if (employeeRowId) await userRepo.delete(employeeRowId);
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

  /**
   * Data-path proof for the SLA-breach chain (Task 10): a real overdue
   * pending_supervisor requisition in Postgres -> POST run-checks -> a persisted
   * sla_breach notification row addressed to that requisition's supervisor.
   *
   * Owns its own fixture and teardown; reuses the outer app / jwtService /
   * signFor / adminToken (populated by the outer beforeAll before any test here
   * runs) rather than standing up a second Nest application.
   */
  describe('SLA breach data path', () => {
    let reqRepo: Repository<RequisitionEntity>;
    let notifRepo: Repository<NotificationEntity>;

    let slaSupervisorRowId: string;
    let slaRequesterRowId: string;
    let slaRequisitionId: string;
    let slaSupervisorToken: string;

    beforeAll(async () => {
      reqRepo = app.get<Repository<RequisitionEntity>>(
        getRepositoryToken(RequisitionEntity),
      );
      notifRepo = app.get<Repository<NotificationEntity>>(
        getRepositoryToken(NotificationEntity),
      );

      const stamp = Date.now();

      const supervisor = await userRepo.save(
        userRepo.create({
          employeeId: `E2E-SLA-SUP-${stamp}`,
          firstName: 'E2E',
          lastName: 'SlaSupervisor',
          email: `e2e-sla-sup-${stamp}@example.invalid`,
          passwordHash: '$2b$12$placeholder.hash.not.used.by.this.test.suite',
          role: UserRole.SUPERVISOR,
          division: 'Test',
          officeOrSection: 'Test',
        }),
      );
      slaSupervisorRowId = supervisor.id;
      slaSupervisorToken = signFor(supervisor);

      const requester = await userRepo.save(
        userRepo.create({
          employeeId: `E2E-SLA-EMP-${stamp}`,
          firstName: 'E2E',
          lastName: 'SlaRequester',
          email: `e2e-sla-emp-${stamp}@example.invalid`,
          passwordHash: '$2b$12$placeholder.hash.not.used.by.this.test.suite',
          role: UserRole.EMPLOYEE,
          division: 'Test',
          officeOrSection: 'Test',
        }),
      );
      slaRequesterRowId = requester.id;

      const requisition = await reqRepo.save(
        reqRepo.create({
          requestNumber: `E2E-SLA-${stamp}`,
          requisitionType: RequisitionType.NEW,
          justification: 'e2e sla breach',
          requiredDate: new Date(),
          status: RequisitionStatus.PENDING_SUPERVISOR,
          supervisorId: supervisor.id,
          requestedById: requester.id,
          submittedAt: new Date(Date.now() - 48 * 3600 * 1000),
          slaDeadline: new Date(Date.now() - 24 * 3600 * 1000),
          slaBreachNotifiedAt: null,
          items: [],
        }),
      );
      slaRequisitionId = requisition.id;
    });

    afterAll(async () => {
      if (slaRequisitionId) {
        await notifRepo.delete({ relatedRecordId: slaRequisitionId });
        await reqRepo.delete(slaRequisitionId);
      }
      if (slaSupervisorRowId) await userRepo.delete(slaSupervisorRowId);
      if (slaRequesterRowId) await userRepo.delete(slaRequesterRowId);
    });

    it('run-checks persists an sla_breach notification for the overdue requisition, addressed to its supervisor', async () => {
      const runRes = await request(app.getHttpServer())
        .post(RUN_CHECKS)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(runRes.body.data.slaBreaches).toBeGreaterThanOrEqual(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${slaSupervisorToken}`)
        .expect(200);

      const notifications = res.body.data.notifications as Array<{
        alertType: string;
        relatedRecordId: string;
      }>;

      expect(
        notifications.some(
          (n) =>
            n.alertType === 'sla_breach' &&
            n.relatedRecordId === slaRequisitionId,
        ),
      ).toBe(true);
    });
  });
});
