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
import {
  AssetClass,
  AssetType,
  UserRole,
} from '../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../packages/shared/src/constants';

// CICC asked for a paper copy after every step, as proof beyond the digital record. A requisition, a
// return / incident request and a repair can each be printed by whoever can see them: every print is
// numbered from one series (no two share a number), a later print of the same record is the next copy,
// and nobody who cannot see the record can print it or even learn what it holds.
describe('Record printouts (e2e)', () => {
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
        employeeId: `PRT-${key}-${tag}`,
        firstName: 'Print',
        lastName: key,
        email: `prt.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash: hash,
        role,
        division: `Print Division ${tag}`,
        officeOrSection: `Print Section ${tag}`,
      }),
    );
  };

  const pdf = (method: 'get' | 'post', url: string, who: string) =>
    request(server())
      [method](url)
      .set(auth(who))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await makeUser('APPROVER', UserRole.SUPERVISOR, hash);
    await makeUser('EMP', UserRole.EMPLOYEE, hash);
    await makeUser('OTHER', UserRole.EMPLOYEE, hash);
    await makeUser('IT', UserRole.IT_PERSONNEL, hash);
    await makeUser('PC', UserRole.PROPERTY_CUSTODIAN, hash);
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

  describe('a requisition', () => {
    let reqId: string;

    beforeAll(async () => {
      const filed = await request(server())
        .post('/api/v1/requisitions')
        .set(auth('EMP'))
        .send({
          requisitionType: 'new',
          justification: 'Needed for the section and not in stock right now',
          requiredDate: inAWeek(),
          items: [
            {
              assetType: AssetType.ICT,
              assetClass: AssetClass.SEP,
              itemDescription: `Printout laptop ${tag}`,
              quantity: 1,
            },
          ],
        })
        .expect(201);
      reqId = filed.body.data.id as string;
      await request(server())
        .post(`/api/v1/requisitions/${reqId}/approve`)
        .set(auth('APPROVER'))
        .send({ comments: 'Approved for the test' })
        .expect(200);
    });

    it('the requester prints it: a numbered PDF', async () => {
      const res = await pdf(
        'post',
        `/api/v1/requisitions/${reqId}/print`,
        'EMP',
      ).expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
      expect(res.headers['x-document-number']).toMatch(/^PR-\d{4}-\d{4}$/);
    });

    it('a printout is not an official document: the requisition lists none under documents', async () => {
      const detail = await request(server())
        .get(`/api/v1/requisitions/${reqId}`)
        .set(auth('EMP'))
        .expect(200);

      expect(detail.body.data.documents).toEqual([]);
    });

    it('a second print is the next copy with its own number, and both are listed', async () => {
      const second = await pdf(
        'post',
        `/api/v1/requisitions/${reqId}/print`,
        'EMP',
      ).expect(200);

      const list = await request(server())
        .get(`/api/v1/requisitions/${reqId}/prints`)
        .set(auth('EMP'))
        .expect(200);
      const prints = list.body.data as Array<{
        documentNumber: string;
        copy: number;
        printedByName: string;
      }>;

      expect(prints.map((p) => p.copy)).toEqual([1, 2]);
      expect(new Set(prints.map((p) => p.documentNumber)).size).toBe(2);
      expect(prints[1].documentNumber).toBe(
        second.headers['x-document-number'],
      );
      expect(prints[0].printedByName).toBe('Print EMP');
    });

    it('everyone who can see the requisition can print it: the approver, the custodian of that type, Admin, Management', async () => {
      for (const who of ['APPROVER', 'IT', 'ADMIN', 'MGMT']) {
        await pdf('post', `/api/v1/requisitions/${reqId}/print`, who).expect(
          200,
        );
      }
    });

    it("somebody else's requisition cannot be printed or listed", async () => {
      const print = await pdf(
        'post',
        `/api/v1/requisitions/${reqId}/print`,
        'OTHER',
      );
      const list = await request(server())
        .get(`/api/v1/requisitions/${reqId}/prints`)
        .set(auth('OTHER'));

      expect([403, 404]).toContain(print.status);
      expect([403, 404]).toContain(list.status);
    });

    it('a stored print can be downloaded again by the requester', async () => {
      const list = await request(server())
        .get(`/api/v1/requisitions/${reqId}/prints`)
        .set(auth('EMP'))
        .expect(200);
      const first = (list.body.data as Array<{ id: string }>)[0];

      const again = await pdf(
        'get',
        `/api/v1/requisitions/${reqId}/documents/${first.id}`,
        'EMP',
      ).expect(200);

      expect((again.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });

    it('the COA form generator will not make one', async () => {
      await request(server())
        .post('/api/v1/reports/forms/generate')
        .set(auth('IT'))
        .send({ formType: 'RECORD_PRINT' })
        .expect(400);
    });

    it('requires a signed-in user', async () => {
      await request(server())
        .post(`/api/v1/requisitions/${reqId}/print`)
        .expect(401);
    });
  });

  describe('a return request and a repair on an issued asset', () => {
    let assetId: string;
    let requestId: string;
    let repairId: string;

    beforeAll(async () => {
      const created = await request(server())
        .post('/api/v1/assets')
        .set(auth('IT'))
        .send({
          itemDescription: `Printout monitor ${tag}`,
          propertyNumber: `PRT-${tag}`,
          assetClass: AssetClass.SEP,
          assetType: AssetType.ICT,
        })
        .expect(201);
      assetId = created.body.data.id as string;
      await request(server())
        .patch(`/api/v1/assets/${assetId}/lifecycle`)
        .set(auth('IT'))
        .send({ status: 'available', notes: 'ready' })
        .expect(200);
      await request(server())
        .patch(`/api/v1/assets/${assetId}/lifecycle`)
        .set(auth('IT'))
        .send({
          status: 'issued',
          employeeId: users.EMP.employeeId,
          notes: 'issued for the printout test',
        })
        .expect(200);

      const filed = await request(server())
        .post('/api/v1/asset-requests')
        .set(auth('EMP'))
        .field('assetId', assetId)
        .field('type', 'return')
        .field('preferredDate', inAWeek())
        .field(
          'details',
          'Returning this monitor because it is no longer needed here.',
        )
        .expect(201);
      requestId = filed.body.data.id as string;
    });

    it('the holder prints their own request; the custodian of that type prints it too', async () => {
      const mine = await pdf(
        'post',
        `/api/v1/asset-requests/${requestId}/print`,
        'EMP',
      ).expect(200);
      await pdf(
        'post',
        `/api/v1/asset-requests/${requestId}/print`,
        'IT',
      ).expect(200);

      expect(mine.headers['x-document-number']).toMatch(/^PR-\d{4}-\d{4}$/);
    });

    it('another employee and the other custodian type cannot print it', async () => {
      await pdf(
        'post',
        `/api/v1/asset-requests/${requestId}/print`,
        'OTHER',
      ).expect(403);
      await pdf(
        'post',
        `/api/v1/asset-requests/${requestId}/print`,
        'PC',
      ).expect(403);
      await request(server())
        .get(`/api/v1/asset-requests/${requestId}/prints`)
        .set(auth('OTHER'))
        .expect(403);
    });

    it('the holder prints the repair of their own item', async () => {
      await request(server())
        .patch(`/api/v1/assets/${assetId}/lifecycle`)
        .set(auth('IT'))
        .send({ status: 'under_repair', notes: 'Flickering screen' })
        .expect(200);
      const open = await request(server())
        .get('/api/v1/repairs?status=open')
        .set(auth('IT'))
        .expect(200);
      repairId = (
        open.body.data as Array<{ id: string; asset: { id: string } }>
      ).find((r) => r.asset.id === assetId)?.id as string;
      expect(repairId).toBeTruthy();

      const mine = await pdf(
        'post',
        `/api/v1/repairs/${repairId}/print`,
        'EMP',
      ).expect(200);
      await pdf('post', `/api/v1/repairs/${repairId}/print`, 'IT').expect(200);
      await pdf('post', `/api/v1/repairs/${repairId}/print`, 'MGMT').expect(
        200,
      );

      expect(mine.headers['x-document-number']).toMatch(/^PR-\d{4}-\d{4}$/);
    });

    it('nobody else may print or read that repair, and a stored print downloads for those who may', async () => {
      await pdf('post', `/api/v1/repairs/${repairId}/print`, 'OTHER').expect(
        403,
      );
      await pdf('post', `/api/v1/repairs/${repairId}/print`, 'PC').expect(403);
      await request(server())
        .get(`/api/v1/repairs/${repairId}/prints`)
        .set(auth('APPROVER'))
        .expect(403);

      const list = await request(server())
        .get(`/api/v1/repairs/${repairId}/prints`)
        .set(auth('EMP'))
        .expect(200);
      const first = (list.body.data as Array<{ id: string }>)[0];
      await pdf(
        'get',
        `/api/v1/repairs/${repairId}/prints/${first.id}`,
        'EMP',
      ).expect(200);
      await pdf(
        'get',
        `/api/v1/repairs/${repairId}/prints/${first.id}`,
        'OTHER',
      ).expect(403);
    });

    it('never hands a print of one record to a request for another', async () => {
      const list = await request(server())
        .get(`/api/v1/repairs/${repairId}/prints`)
        .set(auth('EMP'))
        .expect(200);
      const first = (list.body.data as Array<{ id: string }>)[0];

      // the repair's print id used under the asset request's own download route
      await pdf(
        'get',
        `/api/v1/asset-requests/${requestId}/documents/${first.id}`,
        'EMP',
      ).expect(404);
    });
  });

  it('every print across the three kinds has its own number', async () => {
    const rows: Array<{ document_number: string }> = await app
      .get(DataSource)
      .query(
        `SELECT document_number FROM generated_forms WHERE form_type = 'RECORD_PRINT'`,
      );
    const numbers = rows.map((r) => r.document_number);

    expect(numbers.length).toBeGreaterThanOrEqual(8);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  // The archive is not scoped by asset type and its download route only checks the
  // caller's role, so a printout there would be readable across scopes. A printout
  // is read through its own record (checked above), never through the archive.
  describe('the forms archive', () => {
    it('does not list printouts, whether or not they are asked for by type', async () => {
      const asked = await request(server())
        .get('/api/v1/reports/forms?formType=RECORD_PRINT&limit=100')
        .set(auth('ADMIN'))
        .expect(200);
      expect(asked.body.data.data).toEqual([]);

      const all = await request(server())
        .get('/api/v1/reports/forms?limit=100')
        .set(auth('ADMIN'))
        .expect(200);
      const types = (all.body.data.data as Array<{ formType: string }>).map(
        (f) => f.formType,
      );
      expect(types).not.toContain('RECORD_PRINT');
    });

    it('will not hand a printout over through the archive download', async () => {
      const rows: Array<{ id: string }> = await app
        .get(DataSource)
        .query(
          `SELECT id FROM generated_forms WHERE form_type = 'RECORD_PRINT' LIMIT 1`,
        );

      await pdf(
        'get',
        `/api/v1/reports/forms/${rows[0].id}/download`,
        'IT',
      ).expect(404);
    });
  });
});
