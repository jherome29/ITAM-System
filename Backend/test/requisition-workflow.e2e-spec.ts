import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UserEntity } from '../src/users/entities/user.entity';
import { AssetEntity } from '../src/assets/entities/asset.entity';
import {
  UserRole,
  AssetClass,
  AssetType,
  AssetStatus,
  AssetCondition,
} from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// Full requisition lifecycle: submit -> approve -> fulfill -> issue.
// Per CLAUDE.md §12 ("Requisition workflow end-to-end (submit -> approve ->
// fulfill -> update asset)") — previously uncovered by any test in this repo.
describe('Requisition workflow (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;
  let assetRepo: Repository<AssetEntity>;

  let employeeId: string;
  let supervisorId: string;
  let assetId: string;

  const password = 'E2eTest@Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // matches main.ts bootstrap() — not implied by AppModule alone
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    assetRepo = moduleFixture.get(getRepositoryToken(AssetEntity));

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const employee = await userRepo.save(
      userRepo.create({
        employeeId: 'E2E-EMP-001',
        firstName: 'Test',
        lastName: 'Employee',
        email: 'e2e.employee@cicc.gov.ph',
        passwordHash,
        role: UserRole.EMPLOYEE,
        division: 'Test Division',
        officeOrSection: 'Test Section',
      }),
    );
    employeeId = employee.id;

    const supervisor = await userRepo.save(
      userRepo.create({
        employeeId: 'E2E-SUP-001',
        firstName: 'Test',
        lastName: 'Supervisor',
        email: 'e2e.supervisor@cicc.gov.ph',
        passwordHash,
        role: UserRole.SUPERVISOR,
        division: 'Test Division',
        officeOrSection: 'Test Section',
      }),
    );
    supervisorId = supervisor.id;

    await userRepo.save(
      userRepo.create({
        employeeId: 'E2E-IT-001',
        firstName: 'Test',
        lastName: 'ITPersonnel',
        email: 'e2e.itpersonnel@cicc.gov.ph',
        passwordHash,
        role: UserRole.IT_PERSONNEL,
        division: 'IT Division',
        officeOrSection: 'IT Operations',
      }),
    );

    const asset = await assetRepo.save(
      assetRepo.create({
        itemDescription: 'E2E Test Laptop',
        assetClass: AssetClass.PPE,
        assetType: AssetType.ICT,
        condition: AssetCondition.SERVICEABLE,
        status: AssetStatus.AVAILABLE,
        propertyNumber: 'E2E-PROP-001',
        serialNumber: 'E2E-SN-001',
      }),
    );
    assetId = asset.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const loginAs = async (emailOrEmployeeId: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrEmployeeId, password })
      .expect(200);
    return res.body.data.accessToken as string;
  };

  it('walks a requisition through submit -> approve -> fulfill -> asset issuance', async () => {
    // 1. Employee submits a requisition, nominating the test supervisor
    const employeeToken = await loginAs('e2e.employee@cicc.gov.ph');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requisitionType: 'new',
        justification: 'E2E test requisition',
        requiredDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        supervisorId,
        items: [
          {
            assetType: AssetType.ICT,
            assetClass: AssetClass.PPE,
            itemDescription: 'Laptop for fieldwork',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    const requisitionId: string = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('pending_supervisor');

    // 2. Supervisor approves it
    const supervisorToken = await loginAs('e2e.supervisor@cicc.gov.ph');

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${requisitionId}/approve`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ comments: 'Approved for E2E test' })
      .expect(200);

    expect(approveRes.body.data.status).toBe('pending_fulfillment');

    // 3. IT Personnel fulfills it, linking the pre-created asset
    const itToken = await loginAs('e2e.itpersonnel@cicc.gov.ph');

    const itemId: string = approveRes.body.data.items[0].id;

    const fulfillRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${requisitionId}/fulfill`)
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        notes: 'Fulfilled for E2E test',
        fulfilledItems: [{ requisitionItemId: itemId, assetId }],
      })
      .expect(200);

    expect(fulfillRes.body.data.status).toBe('fulfilled');

    // 4. IT Personnel issues the linked asset — a separate lifecycle transition
    // (fulfill() only links the asset ID; it does not change the asset's own
    // status, per CLAUDE.md §11.15's documented ISSUED lifecycle flow).
    const lifecycleRes = await request(app.getHttpServer())
      .patch(`/api/v1/assets/${assetId}/lifecycle`)
      .set('Authorization', `Bearer ${itToken}`)
      .send({ status: 'issued', employeeId: 'E2E-EMP-001' })
      .expect(200);

    expect(lifecycleRes.body.data.status).toBe('issued');
    expect(lifecycleRes.body.data.custodianId).toBe(employeeId);
  });

  it('rejects an Employee attempting to approve their own requisition', async () => {
    const employeeToken = await loginAs('e2e.employee@cicc.gov.ph');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requisitionType: 'new',
        justification: 'Second E2E test requisition',
        requiredDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        items: [
          {
            assetType: AssetType.ICT,
            assetClass: AssetClass.PPE,
            itemDescription: 'Another laptop',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${createRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({})
      .expect(403);
  });
});
