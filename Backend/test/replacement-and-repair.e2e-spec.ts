import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
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
  OfficialFormType,
} from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// Repair and replacement, end to end, for every role that can hold property
// (CLAUDE.md §6 Module 2 + Module 6, §17):
//   - Replacement = requisition from My Assigned Assets → Approving Officer →
//     custodian fulfils, which takes the old unit back (returned + receipt).
//   - Repair      = Returns & Incidents request → the asset type's custodian
//     approves and receives it → under_repair. A custodian's own request falls
//     back to the System Administrator (segregation of duties).
//   - A "repair" requisition is refused — repairs are not requisitions.
interface MineRow {
  id: string;
  replacement: {
    eligible: boolean;
    basis: string | null;
    openRequestNumber: string | null;
  };
}

describe('Replacement and repair workflows (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;
  let assetRepo: Repository<AssetEntity>;
  let dataSource: DataSource;

  // Unique per run: the e2e database is shared by every spec file.
  const tag = randomUUID().slice(0, 8);
  const division = `RR Division ${tag}`;
  const password = 'E2eTest@Password123!';
  const users: Record<string, UserEntity> = {};
  const tokens: Record<string, string> = {};
  const assets: Record<string, AssetEntity> = {};

  const server = () => app.getHttpServer();
  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const inAWeek = () =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const makeUser = async (
    key: string,
    role: UserRole,
    officeOrSection: string,
    passwordHash: string,
  ) => {
    users[key] = await userRepo.save(
      userRepo.create({
        employeeId: `RR-${key}-${tag}`,
        firstName: 'RR',
        lastName: key,
        email: `rr.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash,
        role,
        division,
        officeOrSection,
      }),
    );
  };

  const makeAsset = (
    key: string,
    holder: string | null,
    over: Partial<AssetEntity> = {},
  ) =>
    assetRepo
      .save(
        assetRepo.create({
          itemDescription: `RR ${key} ${tag}`,
          assetClass: AssetClass.PPE,
          assetType: AssetType.ICT,
          condition: AssetCondition.SERVICEABLE,
          status: holder ? AssetStatus.ISSUED : AssetStatus.AVAILABLE,
          custodianId: holder ? users[holder].id : null,
          acquisitionDate: new Date(),
          propertyNumber: `RR-PROP-${key}-${tag}`,
          ...over,
        }),
      )
      .then((a) => (assets[key] = a));

  const reload = (key: string) =>
    assetRepo.findOneByOrFail({ id: assets[key].id });

  const replacementBody = (assetKey: string, over: object = {}) => ({
    requisitionType: 'replacement',
    replacedAssetId: assets[assetKey].id,
    justification: 'Current unit is failing and blocks daily work',
    requiredDate: inAWeek(),
    items: [
      {
        assetType: AssetType.ICT,
        assetClass: AssetClass.PPE,
        itemDescription: `RR Stock Laptop ${tag}`,
        quantity: 1,
      },
    ],
    ...over,
  });

  const fileAssetRequest = (who: string, assetKey: string, type: string) =>
    request(server())
      .post('/api/v1/asset-requests')
      .set(auth(who))
      .field('assetId', assets[assetKey].id)
      .field('type', type)
      .field('preferredDate', inAWeek())
      .field('details', 'Keyboard and trackpad stopped responding');

  // Approve + receive. Returns the completed request body.
  const approveAndReceive = async (decider: string, requestId: string) => {
    await request(server())
      .patch(`/api/v1/asset-requests/${requestId}/approve`)
      .set(auth(decider))
      .send({})
      .expect(200);
    const done = await request(server())
      .patch(`/api/v1/asset-requests/${requestId}/complete`)
      .set(auth(decider))
      .field('notes', 'Received for repair')
      .expect(200);
    return (done.body as { data: { status: string } }).data;
  };

  // Approve with whoever the requisition was routed to, then fulfil as IT.
  const approveAndFulfil = async (requisitionId: string) => {
    const routedTo = await request(server())
      .get(`/api/v1/requisitions/${requisitionId}`)
      .set(auth('IT'))
      .expect(200);
    const approverKey = Object.keys(users).find(
      (k) => users[k].id === routedTo.body.data.supervisorId,
    )!;
    expect(approverKey).toBeDefined();
    await request(server())
      .post(`/api/v1/requisitions/${requisitionId}/approve`)
      .set(auth(approverKey))
      .send({ comments: 'Replacement justified' })
      .expect(200);
    return request(server())
      .post(`/api/v1/requisitions/${requisitionId}/fulfill`)
      .set(auth('IT'))
      .send({ notes: 'Replacement issued, old unit collected' })
      .expect(200);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // matches main.ts bootstrap()
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    assetRepo = moduleFixture.get(getRepositoryToken(AssetEntity));
    dataSource = moduleFixture.get(DataSource);

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await makeUser('EMP', UserRole.EMPLOYEE, `Ops ${tag}`, hash);
    await makeUser('SUP', UserRole.SUPERVISOR, `Ops ${tag}`, hash);
    await makeUser('SUP2', UserRole.SUPERVISOR, `Legal ${tag}`, hash);
    await makeUser('IT', UserRole.IT_PERSONNEL, `IT Ops ${tag}`, hash);
    await makeUser('PC', UserRole.PROPERTY_CUSTODIAN, `Property ${tag}`, hash);
    await makeUser('ADMIN', UserRole.SYSTEM_ADMIN, `Sysad ${tag}`, hash);

    // One login per account — a second login bumps tokenVersion (§11 #14).
    for (const key of Object.keys(users)) {
      const res = await request(server())
        .post('/api/v1/auth/login')
        .send({ emailOrEmployeeId: users[key].email, password })
        .expect(200);
      tokens[key] = res.body.data.accessToken as string;
    }

    await makeAsset('EmpBroken', 'EMP', {
      condition: AssetCondition.UNSERVICEABLE,
    });
    await makeAsset('EmpFine', 'EMP');
    await makeAsset('SupBroken', 'SUP', {
      condition: AssetCondition.UNSERVICEABLE,
    });
    await makeAsset('SupChair', 'SUP', {
      assetType: AssetType.FIXED,
      assetClass: AssetClass.SEP,
    });
    await makeAsset('ItOwn', 'IT');
    await makeAsset('EmpLost', 'EMP');
    await makeAsset('Stock', null, {
      itemDescription: `RR Stock Laptop ${tag}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('replacement requisitions', () => {
    let employeeReplacementId: string;

    it('My Assigned Assets says which assets qualify, and why', async () => {
      const res = await request(server())
        .get('/api/v1/assets/mine')
        .set(auth('EMP'))
        .expect(200);
      const mineRows = (res.body as { data: MineRow[] }).data;
      const byId = (key: string) =>
        mineRows.find((a) => a.id === assets[key].id)!;
      expect(byId('EmpBroken').replacement).toMatchObject({
        eligible: true,
        basis: 'condition',
        openRequestNumber: null,
      });
      expect(byId('EmpFine').replacement.eligible).toBe(false);
    });

    it('refuses a repair requisition — repairs go through Returns & Incidents', async () => {
      const res = await request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send(replacementBody('EmpBroken', { requisitionType: 'repair' }))
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('My Assigned Assets');
    });

    it('refuses to replace a serviceable asset within its useful life', () =>
      request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send(replacementBody('EmpFine'))
        .expect(400));

    it('refuses to replace an asset the requester does not hold', () =>
      request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send(replacementBody('SupBroken'))
        .expect(403));

    it('Employee: submits, sees it as open, and cannot file a duplicate', async () => {
      const res = await request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send(replacementBody('EmpBroken'))
        .expect(201);
      employeeReplacementId = res.body.data.id;
      expect(res.body.data.supervisorId).toBe(users.SUP.id);

      const mine = await request(server())
        .get('/api/v1/assets/mine')
        .set(auth('EMP'))
        .expect(200);
      const broken = (mine.body as { data: MineRow[] }).data.find(
        (a) => a.id === assets.EmpBroken.id,
      )!;
      expect(broken.replacement.openRequestNumber).toBe(
        res.body.data.requestNumber,
      );

      await request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send(replacementBody('EmpBroken'))
        .expect(409);
    });

    it('the Approving Officer sees which asset is being replaced', async () => {
      const res = await request(server())
        .get(`/api/v1/requisitions/${employeeReplacementId}`)
        .set(auth('SUP'))
        .expect(200);
      expect(res.body.data.replacedAsset).toMatchObject({
        id: assets.EmpBroken.id,
        condition: AssetCondition.UNSERVICEABLE,
        status: AssetStatus.ISSUED,
      });
    });

    it('approve → fulfil returns the old unit to custody with its receipt', async () => {
      const fulfilled = await approveAndFulfil(employeeReplacementId);
      expect(fulfilled.body.data.status).toBe('fulfilled');

      const old = await reload('EmpBroken');
      expect(old.status).toBe(AssetStatus.RETURNED);
      expect(old.custodianId).toBeNull();

      const receipts: Array<{ form_type: string }> = await dataSource.query(
        'SELECT form_type FROM generated_forms WHERE related_requisition_id = $1',
        [employeeReplacementId],
      );
      expect(receipts.map((r) => r.form_type)).toEqual([
        OfficialFormType.RECEIPT_RETURNED_PROPERTY,
      ]);
    });

    it('Supervisor: their replacement routes to another supervisor, never themself', async () => {
      const res = await request(server())
        .post('/api/v1/requisitions')
        .set(auth('SUP'))
        .send(replacementBody('SupBroken'))
        .expect(201);
      expect(res.body.data.supervisorId).not.toBe(users.SUP.id);

      await approveAndFulfil(res.body.data.id);
      expect((await reload('SupBroken')).status).toBe(AssetStatus.RETURNED);
    });

    it('IT Personnel: can request a replacement for their own qualifying asset', async () => {
      await assetRepo.update(assets.ItOwn.id, {
        condition: AssetCondition.UNSERVICEABLE,
      });
      const res = await request(server())
        .post('/api/v1/requisitions')
        .set(auth('IT'))
        .send(replacementBody('ItOwn'))
        .expect(201);
      // Cancel the scenario here: put the asset back for the repair tests.
      await dataSource.query(
        `UPDATE requisitions SET status = 'cancelled' WHERE id = $1`,
        [res.body.data.id],
      );
      await assetRepo.update(assets.ItOwn.id, {
        condition: AssetCondition.SERVICEABLE,
      });
    });

    it('roles outside the requisition RBAC cannot request one', () =>
      request(server())
        .post('/api/v1/requisitions')
        .set(auth('PC'))
        .send(replacementBody('SupChair'))
        .expect(403));
  });

  describe('repair requests (Returns & Incidents)', () => {
    it('Employee: IT Asset Custodian approves and receives an ICT repair; admin may not', async () => {
      const filed = await fileAssetRequest('EMP', 'EmpFine', 'repair').expect(
        201,
      );
      const id = filed.body.data.id as string;

      await request(server())
        .patch(`/api/v1/asset-requests/${id}/approve`)
        .set(auth('ADMIN'))
        .send({})
        .expect(403);

      const done = await approveAndReceive('IT', id);
      expect(done.status).toBe('completed');
      const asset = await reload('EmpFine');
      expect(asset.status).toBe(AssetStatus.UNDER_REPAIR);
      expect(asset.custodianId).toBe(users.EMP.id); // stays accountable
    });

    it('Supervisor: a Fixed-asset repair goes to the Property Custodian, not IT', async () => {
      const filed = await fileAssetRequest('SUP', 'SupChair', 'repair').expect(
        201,
      );
      const id = filed.body.data.id as string;

      await request(server())
        .patch(`/api/v1/asset-requests/${id}/approve`)
        .set(auth('IT'))
        .send({})
        .expect(403);

      await approveAndReceive('PC', id);
      expect((await reload('SupChair')).status).toBe(AssetStatus.UNDER_REPAIR);
    });

    it('IT Personnel: their own ICT repair escalates to the System Admin', async () => {
      const filed = await fileAssetRequest('IT', 'ItOwn', 'repair').expect(201);
      const id = filed.body.data.id as string;

      const asFiler = await request(server())
        .get(`/api/v1/asset-requests/${id}`)
        .set(auth('IT'))
        .expect(200);
      expect(asFiler.body.data.canAct).toBe(false);
      await request(server())
        .patch(`/api/v1/asset-requests/${id}/approve`)
        .set(auth('IT'))
        .send({})
        .expect(403);

      const queue = await request(server())
        .get('/api/v1/asset-requests?status=open')
        .set(auth('ADMIN'))
        .expect(200);
      const row = (
        queue.body as { data: Array<{ id: string; canAct: boolean }> }
      ).data.find((r) => r.id === id)!;
      expect(row.canAct).toBe(true);

      await approveAndReceive('ADMIN', id);
      const asset = await reload('ItOwn');
      expect(asset.status).toBe(AssetStatus.UNDER_REPAIR);
      expect(asset.custodianId).toBe(users.IT.id);
    });

    it('a repaired item goes back to its holder, who can then file again', async () => {
      // EmpFine went under repair in the first test of this block.
      const back = await request(server())
        .patch(`/api/v1/assets/${assets.EmpFine.id}/lifecycle`)
        .set(auth('IT'))
        .send({ status: 'issued' })
        .expect(200);
      expect(back.body.data).toMatchObject({
        status: AssetStatus.ISSUED,
        custodianId: users.EMP.id,
      });
      await fileAssetRequest('EMP', 'EmpFine', 'return').expect(201);
    });
  });

  describe('one case per item: loss/theft supersedes a pending hand-over', () => {
    it('reporting a loss closes the approved return; nothing else can be filed', async () => {
      const ret = await fileAssetRequest('EMP', 'EmpLost', 'return').expect(
        201,
      );
      const returnId = ret.body.data.id as string;
      await request(server())
        .patch(`/api/v1/asset-requests/${returnId}/approve`)
        .set(auth('IT'))
        .send({})
        .expect(200);

      // A second hand-over request is blocked while the return is open…
      await fileAssetRequest('EMP', 'EmpLost', 'repair').expect(409);
      // …but the item can still go missing before hand-over.
      const loss = await fileAssetRequest('EMP', 'EmpLost', 'loss').expect(201);

      const closed = await request(server())
        .get(`/api/v1/asset-requests/${returnId}`)
        .set(auth('EMP'))
        .expect(200);
      expect(closed.body.data.status).toBe('cancelled');
      expect(closed.body.data.decisionNotes).toContain(
        loss.body.data.requestNumber,
      );

      // While the loss is open, nothing else can be filed on the item.
      await fileAssetRequest('EMP', 'EmpLost', 'theft').expect(409);

      const done = await approveAndReceive('IT', loss.body.data.id as string);
      expect(done.status).toBe('completed');
      const asset = await reload('EmpLost');
      expect(asset.status).toBe(AssetStatus.FLAGGED_FOR_DISPOSAL);
      expect(asset.custodianId).toBe(users.EMP.id); // until COA relief
    });
  });
});
