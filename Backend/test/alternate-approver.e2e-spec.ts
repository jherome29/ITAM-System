import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { UserRole } from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// Alternate Approver (CLAUDE.md §5, §17): a supervisor marks themselves away,
// their designated alternate receives and can approve the requisition; once
// they are back, routing returns to the primary.
describe('Alternate approver (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;

  const password = 'E2eTest@Password123!';
  let primaryId: string;
  let alternateId: string;

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: email, password })
    ).body.data.accessToken as string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const mk = (over: Partial<UserEntity>) =>
      userRepo.create({
        passwordHash,
        isActive: true,
        division: 'CISD',
        officeOrSection: 'AA-E2E',
        firstName: 'E2E',
        lastName: 'User',
        ...over,
      } as UserEntity);

    await userRepo.save(
      mk({
        employeeId: 'E2E-AA-ADM',
        email: 'e2e.aa.admin@cicc.gov.ph',
        role: UserRole.SYSTEM_ADMIN,
      }),
    );
    const primary = await userRepo.save(
      mk({
        employeeId: 'E2E-AA-SUP1',
        email: 'e2e.aa.sup1@cicc.gov.ph',
        role: UserRole.SUPERVISOR,
      }),
    );
    const alternate = await userRepo.save(
      mk({
        employeeId: 'E2E-AA-SUP2',
        email: 'e2e.aa.sup2@cicc.gov.ph',
        role: UserRole.SUPERVISOR,
        officeOrSection: 'BB-E2E',
      }),
    );
    await userRepo.save(
      mk({
        employeeId: 'E2E-AA-EMP',
        email: 'e2e.aa.emp@cicc.gov.ph',
        role: UserRole.EMPLOYEE,
      }),
    );
    primaryId = primary.id;
    alternateId = alternate.id;
  });

  afterAll(async () => {
    // The CI test DB is disposable — no teardown of the rows this suite creates.
    if (app) await app.close();
  });

  it('designates the alternate, sends the primary away, routes a new requisition to the alternate, and lets them approve', async () => {
    const adminToken = await login('e2e.aa.admin@cicc.gov.ph');

    // designate
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${primaryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alternateApproverId: alternateId })
      .expect(200);

    // primary marks self unavailable
    const primaryToken = await login('e2e.aa.sup1@cicc.gov.ph');
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/availability')
      .set('Authorization', `Bearer ${primaryToken}`)
      .send({ unavailable: true, unavailableUntil: null })
      .expect(200);

    // employee submits — findSupervisorForSection resolves the primary (section
    // AA-E2E), who is unavailable → routed to the alternate
    const empToken = await login('e2e.aa.emp@cicc.gov.ph');
    const created = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        requisitionType: 'new',
        justification: 'e2e alternate approver',
        requiredDate: new Date(Date.now() + 7 * 864e5).toISOString(),
        items: [
          {
            assetType: 'ICT',
            assetClass: 'SEP',
            itemDescription: 'e2e keyboard',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    const reqId = created.body.data.id;
    expect(created.body.data.supervisorId).toBe(alternateId);
    expect(created.body.data.alternateRoutedAt).toBeTruthy();

    // the alternate can approve it (ownership check passes — supervisorId is
    // theirs now). approve() is @HttpCode(OK) → 200, not 201.
    const altToken = await login('e2e.aa.sup2@cicc.gov.ph');
    const approved = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${altToken}`)
      .send({ comments: 'ok' })
      .expect(200);
    expect(approved.body.data.status).toBe('pending_fulfillment');
  });

  it('routes back to the primary once they are available again', async () => {
    const primaryToken = await login('e2e.aa.sup1@cicc.gov.ph');
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/availability')
      .set('Authorization', `Bearer ${primaryToken}`)
      .send({ unavailable: false, unavailableUntil: null })
      .expect(200);

    const empToken = await login('e2e.aa.emp@cicc.gov.ph');
    const created = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        requisitionType: 'new',
        justification: 'e2e primary back',
        requiredDate: new Date(Date.now() + 7 * 864e5).toISOString(),
        items: [
          {
            assetType: 'ICT',
            assetClass: 'SEP',
            itemDescription: 'e2e mouse',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    expect(created.body.data.supervisorId).toBe(primaryId);
    expect(created.body.data.alternateRoutedAt).toBeFalsy();
  });
});
