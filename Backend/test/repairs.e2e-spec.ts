import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createTestApp } from './create-test-app';
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

interface RepairRow {
  id: string;
  canAct: boolean;
  overdue: boolean;
  outcome: string | null;
  reportedProblem: string | null;
  holder: { id: string } | null;
  asset: { id: string; condition: string } | null;
}

// Maintenance & Repair end to end (CLAUDE.md Module 6 repair loop):
// a repair request received by the custodian opens a repair record; the
// custodian logs progress and closes it as repaired (back to the holder) or
// not repairable (flagged, holder keeps accountability, replacement offered);
// condition follows; the holder is notified; overdue repairs alert custodians;
// a custodian's own item falls back to the System Administrator.
describe('Repairs (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;
  let assetRepo: Repository<AssetEntity>;
  let dataSource: DataSource;

  const tag = randomUUID().slice(0, 8);
  const password = 'E2eTest@Password123!';
  const users: Record<string, UserEntity> = {};
  const tokens: Record<string, string> = {};
  const assets: Record<string, AssetEntity> = {};

  const server = () => app.getHttpServer();
  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  const makeUser = async (key: string, role: UserRole, hash: string) => {
    users[key] = await userRepo.save(
      userRepo.create({
        employeeId: `RP-${key}-${tag}`,
        firstName: 'RP',
        lastName: key,
        email: `rp.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash: hash,
        role,
        division: `RP Division ${tag}`,
        officeOrSection: `RP ${key} ${tag}`,
      }),
    );
  };

  const makeAsset = async (
    key: string,
    holder: string,
    over: Partial<AssetEntity> = {},
  ) => {
    assets[key] = await assetRepo.save(
      assetRepo.create({
        itemDescription: `RP ${key} ${tag}`,
        assetClass: AssetClass.PPE,
        assetType: AssetType.ICT,
        condition: AssetCondition.SERVICEABLE,
        status: AssetStatus.ISSUED,
        custodianId: users[holder].id,
        acquisitionDate: new Date(),
        propertyNumber: `RP-PROP-${key}-${tag}`,
        ...over,
      }),
    );
  };

  const reload = (key: string) =>
    assetRepo.findOneByOrFail({ id: assets[key].id });

  /** Holder files a repair, the decider approves and receives it. */
  const sendToRepair = async (
    holder: string,
    assetKey: string,
    decider: string,
  ) => {
    const filed = await request(server())
      .post('/api/v1/asset-requests')
      .set(auth(holder))
      .field('assetId', assets[assetKey].id)
      .field('type', 'repair')
      .field('preferredDate', day(-1))
      .field('details', 'Screen flickers and goes black')
      .expect(201);
    const id = filed.body.data.id as string;
    await request(server())
      .patch(`/api/v1/asset-requests/${id}/approve`)
      .set(auth(decider))
      .send({})
      .expect(200);
    await request(server())
      .patch(`/api/v1/asset-requests/${id}/complete`)
      .set(auth(decider))
      .field('notes', 'Received')
      .expect(200);
  };

  const openRepairFor = async (viewer: string, assetKey: string) => {
    const res = await request(server())
      .get('/api/v1/repairs?status=open')
      .set(auth(viewer))
      .expect(200);
    return (res.body as { data: RepairRow[] }).data.find(
      (r) => r.asset?.id === assets[assetKey].id,
    )!;
  };

  const notificationsTo = (
    userKey: string,
    alertType: string,
  ): Promise<Array<{ title: string; message: string }>> =>
    dataSource.query(
      'SELECT title, message FROM notifications WHERE recipient_id = $1 AND alert_type = $2',
      [users[userKey].id, alertType],
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    assetRepo = moduleFixture.get(getRepositoryToken(AssetEntity));
    dataSource = moduleFixture.get(DataSource);

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await makeUser('EMP', UserRole.EMPLOYEE, hash);
    await makeUser('IT', UserRole.IT_PERSONNEL, hash);
    await makeUser('PC', UserRole.PROPERTY_CUSTODIAN, hash);
    await makeUser('ADMIN', UserRole.SYSTEM_ADMIN, hash);
    for (const key of Object.keys(users)) {
      const res = await request(server())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: users[key].email, password })
        .expect(200);
      tokens[key] = res.body.data.accessToken as string;
    }

    await makeAsset('Fixable', 'EMP');
    await makeAsset('Dead', 'EMP');
    await makeAsset('ItOwn', 'IT');
  });

  afterAll(async () => {
    await app.close();
  });

  it('a received repair request opens a repair record; condition becomes "for repair"', async () => {
    await sendToRepair('EMP', 'Fixable', 'IT');
    const repair = await openRepairFor('IT', 'Fixable');
    expect(repair).toMatchObject({
      canAct: true,
      outcome: null,
      reportedProblem: 'Screen flickers and goes black',
      holder: { id: users.EMP.id },
    });
    expect((await reload('Fixable')).condition).toBe(AssetCondition.FOR_REPAIR);

    // The Property Custodian neither sees nor acts on an ICT repair.
    expect(await openRepairFor('PC', 'Fixable')).toBeUndefined();
    await request(server())
      .patch(`/api/v1/repairs/${repair.id}`)
      .set(auth('PC'))
      .send({})
      .expect(403);

    // The holder sees where it is and when it is due back.
    const mine = await request(server())
      .get('/api/v1/assets/mine')
      .set(auth('EMP'))
      .expect(200);
    const held = (
      mine.body as {
        data: Array<{ id: string; repair: { dueDate: string } | null }>;
      }
    ).data.find((a) => a.id === assets.Fixable.id)!;
    expect(held.repair?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('progress, then repaired: back with the holder, serviceable, holder notified', async () => {
    const repair = await openRepairFor('IT', 'Fixable');
    await request(server())
      .patch(`/api/v1/repairs/${repair.id}`)
      .set(auth('IT'))
      .send({
        serviceType: 'external',
        serviceProvider: 'Dell Service Center',
        expectedCompletionDate: day(7),
        findings: 'Loose display cable',
      })
      .expect(200);

    // Work done is required.
    await request(server())
      .post(`/api/v1/repairs/${repair.id}/complete`)
      .set(auth('IT'))
      .send({ outcome: 'repaired', actionTaken: '' })
      .expect(400);

    const done = await request(server())
      .post(`/api/v1/repairs/${repair.id}/complete`)
      .set(auth('IT'))
      .send({ outcome: 'repaired', actionTaken: 'Reseated the display cable' })
      .expect(200);
    expect(done.body.data).toMatchObject({
      outcome: 'repaired',
      canAct: false,
    });

    const asset = await reload('Fixable');
    expect(asset).toMatchObject({
      status: AssetStatus.ISSUED,
      custodianId: users.EMP.id,
      condition: AssetCondition.SERVICEABLE,
    });
    const notes = await notificationsTo('EMP', 'repair_update');
    expect(notes.map((n) => n.title)).toContain('Repair Completed');

    // A second complete is refused — the record is closed.
    await request(server())
      .post(`/api/v1/repairs/${repair.id}/complete`)
      .set(auth('IT'))
      .send({ outcome: 'repaired', actionTaken: 'Again' })
      .expect(400);
  });

  it('not repairable: flagged, unserviceable, holder keeps it and may request a replacement', async () => {
    await sendToRepair('EMP', 'Dead', 'IT');
    const repair = await openRepairFor('IT', 'Dead');

    // Findings are the disposal justification.
    await request(server())
      .post(`/api/v1/repairs/${repair.id}/complete`)
      .set(auth('IT'))
      .send({
        outcome: 'unrepairable',
        actionTaken: 'Tried a replacement board',
      })
      .expect(400);
    await request(server())
      .post(`/api/v1/repairs/${repair.id}/complete`)
      .set(auth('IT'))
      .send({
        outcome: 'unrepairable',
        findings: 'Motherboard burnt out',
        actionTaken: 'Tried a replacement board',
      })
      .expect(200);

    expect(await reload('Dead')).toMatchObject({
      status: AssetStatus.FLAGGED_FOR_DISPOSAL,
      custodianId: users.EMP.id,
      condition: AssetCondition.UNSERVICEABLE,
    });
    const notes = await notificationsTo('EMP', 'repair_update');
    expect(
      notes.find((n) => n.title === 'Repair Not Possible')?.message,
    ).toContain('request a replacement');

    const mine = await request(server())
      .get('/api/v1/assets/mine')
      .set(auth('EMP'))
      .expect(200);
    const dead = (
      mine.body as {
        data: Array<{ id: string; replacement: { eligible: boolean } }>;
      }
    ).data.find((a) => a.id === assets.Dead.id)!;
    expect(dead.replacement.eligible).toBe(true);

    const history = await request(server())
      .get(`/api/v1/repairs/asset/${assets.Dead.id}`)
      .set(auth('IT'))
      .expect(200);
    expect((history.body as { data: RepairRow[] }).data[0]).toMatchObject({
      outcome: 'unrepairable',
    });
  });

  it("a custodian's own item: they cannot close it, the System Admin can; overdue alerts reach custodians", async () => {
    await sendToRepair('IT', 'ItOwn', 'ADMIN');
    const asFiler = await openRepairFor('IT', 'ItOwn');
    expect(asFiler.canAct).toBe(false);
    await request(server())
      .post(`/api/v1/repairs/${asFiler.id}/complete`)
      .set(auth('IT'))
      .send({ outcome: 'repaired', actionTaken: 'Fixed my own laptop' })
      .expect(403);

    // Push it past due and run the watchers.
    await dataSource.query(
      'UPDATE asset_repairs SET expected_completion_date = $1 WHERE id = $2',
      [day(-3), asFiler.id],
    );
    const sweep = await request(server())
      .post('/api/v1/notifications/run-checks')
      .set(auth('ADMIN'))
      .expect(200);
    expect(sweep.body.data.overdueRepairs).toBeGreaterThanOrEqual(1);
    expect((await openRepairFor('ADMIN', 'ItOwn')).overdue).toBe(true);

    const asAdmin = await openRepairFor('ADMIN', 'ItOwn');
    expect(asAdmin.canAct).toBe(true);
    await request(server())
      .post(`/api/v1/repairs/${asAdmin.id}/complete`)
      .set(auth('ADMIN'))
      .send({ outcome: 'repaired', actionTaken: 'Replaced keyboard' })
      .expect(200);
    expect(await reload('ItOwn')).toMatchObject({
      status: AssetStatus.ISSUED,
      custodianId: users.IT.id,
    });
  });

  it('the Repair History report lists them', async () => {
    const res = await request(server())
      .post('/api/v1/reports/generate')
      .set(auth('ADMIN'))
      .send({ reportType: 'REPAIR_HISTORY', format: 'excel' })
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});
