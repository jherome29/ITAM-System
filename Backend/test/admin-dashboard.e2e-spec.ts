import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createTestApp } from './create-test-app';
import { UserEntity } from '../src/users/entities/user.entity';
import {
  AssetClass,
  AssetType,
  UserRole,
} from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// The Administration Overview's "Needs your decision": the System Administrator decides exactly what a
// custodian filed for themselves (a custodian may never decide their own), so the dashboard counts those
// and nothing else. The three counts are read from the same services the three Master Admin screens use,
// and this proves it on a real database with the real module wiring: a custodian's own return request,
// repair and requisition raise the count, an employee's do not, and only the administrator may ask.
describe('Administration Overview: needs your decision (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;

  const tag = randomUUID().slice(0, 8);
  const password = 'E2eTest@Password123!';
  const users: Record<string, UserEntity> = {};
  const tokens: Record<string, string> = {};
  const server = () => app.getHttpServer();
  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const inAWeek = () =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const makeUser = async (key: string, role: UserRole, hash: string) => {
    users[key] = await userRepo.save(
      userRepo.create({
        employeeId: `ADM-${key}-${tag}`,
        firstName: 'Dash',
        lastName: key,
        email: `adm.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash: hash,
        role,
        division: `Dash Division ${tag}`,
        officeOrSection: `Dash Section ${tag}`,
      }),
    );
  };

  const decisions = async () => {
    const res = await request(server())
      .get('/api/v1/admin/dashboard-stats')
      .set(auth('ADMIN'))
      .expect(200);
    return res.body.data.decisions as {
      returnsIncidents: number;
      repairs: number;
      requisitions: number;
    };
  };

  // An ICT asset, held by `holder`.
  const issuedAsset = async (label: string, holder: string) => {
    const created = await request(server())
      .post('/api/v1/assets')
      .set(auth('IT'))
      .send({
        itemDescription: `Dash ${label} ${tag}`,
        propertyNumber: `DASH-${label}-${tag}`,
        assetClass: AssetClass.SEP,
        assetType: AssetType.ICT,
      })
      .expect(201);
    const id = created.body.data.id as string;
    await request(server())
      .patch(`/api/v1/assets/${id}/lifecycle`)
      .set(auth('IT'))
      .send({ status: 'available', notes: 'ready' })
      .expect(200);
    await request(server())
      .patch(`/api/v1/assets/${id}/lifecycle`)
      .set(auth('IT'))
      .send({
        status: 'issued',
        employeeId: users[holder].employeeId,
        notes: 'issued for the dashboard test',
      })
      .expect(200);
    return id;
  };

  const fileReturn = (assetId: string, who: string) =>
    request(server())
      .post('/api/v1/asset-requests')
      .set(auth(who))
      .field('assetId', assetId)
      .field('type', 'return')
      .field('preferredDate', inAWeek())
      .field('details', 'Returning this item because it is no longer needed.')
      .expect(201);

  const fileAndApprove = async (who: string) => {
    const filed = await request(server())
      .post('/api/v1/requisitions')
      .set(auth(who))
      .send({
        requisitionType: 'new',
        justification: 'Needed for the section and not in stock right now',
        requiredDate: inAWeek(),
        items: [
          {
            assetType: AssetType.ICT,
            assetClass: AssetClass.SEP,
            itemDescription: `Dash laptop ${who} ${tag}`,
            quantity: 1,
          },
        ],
      })
      .expect(201);
    const id = filed.body.data.id as string;
    await request(server())
      .post(`/api/v1/requisitions/${id}/approve`)
      .set(auth('APPROVER'))
      .send({ comments: 'Approved for the test' })
      .expect(200);
    return id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await makeUser('APPROVER', UserRole.SUPERVISOR, hash);
    await makeUser('EMP', UserRole.EMPLOYEE, hash);
    await makeUser('IT', UserRole.IT_PERSONNEL, hash);
    await makeUser('MGMT', UserRole.MANAGEMENT, hash);
    await makeUser('ADMIN', UserRole.SYSTEM_ADMIN, hash);
    for (const key of Object.keys(users)) {
      const res = await request(server())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: users[key].email, password })
        .expect(200);
      tokens[key] = res.body.data.accessToken as string;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the administrator with the three counts', async () => {
    const d = await decisions();

    expect(Object.keys(d).sort()).toEqual([
      'repairs',
      'requisitions',
      'returnsIncidents',
    ]);
    expect(Object.values(d).every((n) => Number.isInteger(n) && n >= 0)).toBe(
      true,
    );
  });

  it('refuses everyone but the System Administrator (403)', async () => {
    for (const who of ['EMP', 'IT', 'MGMT', 'APPROVER']) {
      await request(server())
        .get('/api/v1/admin/dashboard-stats')
        .set(auth(who))
        .expect(403);
    }
    await request(server()).get('/api/v1/admin/dashboard-stats').expect(401);
  });

  it("counts a custodian's own return request, and not an employee's", async () => {
    const before = await decisions();

    const mine = await issuedAsset('it-return', 'IT');
    await fileReturn(mine, 'IT');
    expect((await decisions()).returnsIncidents).toBe(
      before.returnsIncidents + 1,
    );

    const theirs = await issuedAsset('emp-return', 'EMP');
    await fileReturn(theirs, 'EMP');
    expect((await decisions()).returnsIncidents).toBe(
      before.returnsIncidents + 1,
    );
  });

  it("counts the repair of a custodian's own item, and not an employee's", async () => {
    const before = await decisions();

    const mine = await issuedAsset('it-repair', 'IT');
    await request(server())
      .patch(`/api/v1/assets/${mine}/lifecycle`)
      .set(auth('IT'))
      .send({ status: 'under_repair', notes: 'Flickering screen' })
      .expect(200);
    expect((await decisions()).repairs).toBe(before.repairs + 1);

    const theirs = await issuedAsset('emp-repair', 'EMP');
    await request(server())
      .patch(`/api/v1/assets/${theirs}/lifecycle`)
      .set(auth('IT'))
      .send({ status: 'under_repair', notes: 'Cracked casing' })
      .expect(200);
    expect((await decisions()).repairs).toBe(before.repairs + 1);
  });

  it("counts a custodian's own requisition waiting for fulfilment, and not an employee's", async () => {
    const before = await decisions();

    await fileAndApprove('IT');
    expect((await decisions()).requisitions).toBe(before.requisitions + 1);

    await fileAndApprove('EMP');
    expect((await decisions()).requisitions).toBe(before.requisitions + 1);
  });

  it('stops counting a request once the administrator has decided it', async () => {
    const asset = await issuedAsset('it-decided', 'IT');
    const filed = await fileReturn(asset, 'IT');
    const before = await decisions();

    await request(server())
      .patch(`/api/v1/asset-requests/${filed.body.data.id as string}/approve`)
      .set(auth('ADMIN'))
      .send({})
      .expect(200);
    // approved is still open (the hand-over is the second step), so it is still the administrator's
    expect((await decisions()).returnsIncidents).toBe(before.returnsIncidents);

    await request(server())
      .patch(`/api/v1/asset-requests/${filed.body.data.id as string}/complete`)
      .set(auth('ADMIN'))
      .send({})
      .expect(200);
    expect((await decisions()).returnsIncidents).toBe(
      before.returnsIncidents - 1,
    );
  });
});
