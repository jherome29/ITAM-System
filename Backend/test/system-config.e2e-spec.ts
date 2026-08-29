import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { UserRole } from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// GET/PATCH /api/v1/system-config — SYSTEM_ADMIN only, audited.
// Auth/seeding follows the real harness pattern in requisition-workflow.e2e-spec.ts.
describe('SystemConfig (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;

  const password = 'E2eTest@Password123!';
  const adminEmail = 'e2e.syscfg.admin@cicc.gov.ph';
  const userEmail = 'e2e.syscfg.user@cicc.gov.ph';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // matches main.ts bootstrap() — not implied by AppModule alone
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await userRepo.save(
      userRepo.create({
        employeeId: 'E2E-SYSCFG-ADMIN',
        firstName: 'Test',
        lastName: 'SysCfgAdmin',
        email: adminEmail,
        passwordHash,
        role: UserRole.SYSTEM_ADMIN,
        division: 'Test Division',
        officeOrSection: 'Test Section',
        isActive: true,
      }),
    );

    await userRepo.save(
      userRepo.create({
        employeeId: 'E2E-SYSCFG-USER',
        firstName: 'Test',
        lastName: 'SysCfgUser',
        email: userEmail,
        passwordHash,
        role: UserRole.EMPLOYEE,
        division: 'Test Division',
        officeOrSection: 'Test Section',
        isActive: true,
      }),
    );
  });

  afterAll(async () => {
    // Guard cleanup so a beforeAll bootstrap failure isn't masked by a
    // second error thrown here (userRepo / app would be undefined).
    if (userRepo) {
      await userRepo.delete({ email: adminEmail });
      await userRepo.delete({ email: userEmail });
    }
    if (app) {
      await app.close();
    }
  });

  const loginAs = async (emailOrEmployeeId: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrEmployeeId, password })
      .expect(200);
    return res.body.data.accessToken as string;
  };

  it('GET returns the config snapshot for a System Admin', async () => {
    const token = await loginAs(adminEmail);
    const res = await request(app.getHttpServer())
      .get('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toEqual(
      expect.objectContaining({
        slaApprovalHours: expect.any(Number),
        defaultReorderLevel: expect.any(Number),
        maxLoginAttempts: expect.any(Number),
        usefulLifeYears: expect.objectContaining({
          PPE: expect.any(Number),
          SEP: expect.any(Number),
          IES: expect.any(Number),
        }),
      }),
    );
  });

  it('PATCH persists a change, GET reflects it, then restores the prior value', async () => {
    const token = await loginAs(adminEmail);

    // Capture whatever the value currently is — a real admin may have set it on
    // a shared DB; hardcoding the restore to 24 would silently overwrite that.
    const before = await request(app.getHttpServer())
      .get('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const priorSla = before.body.data.slaApprovalHours as number;
    const probe = priorSla === 30 ? 31 : 30;

    await request(app.getHttpServer())
      .patch('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ slaApprovalHours: probe })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.slaApprovalHours).toBe(probe);

    // restore the value we found so the shared dev DB is left untouched
    await request(app.getHttpServer())
      .patch('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ slaApprovalHours: priorSla })
      .expect(200);
  });

  it('PATCH is 403 for a non-admin', async () => {
    const token = await loginAs(userEmail);
    await request(app.getHttpServer())
      .patch('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ slaApprovalHours: 30 })
      .expect(403);
  });

  it('PATCH rejects an out-of-range value with 400', async () => {
    const token = await loginAs(adminEmail);
    await request(app.getHttpServer())
      .patch('/api/v1/system-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ slaApprovalHours: 0 })
      .expect(400);
  });
});
