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

// The Property Custodian and Property Officer hold property like anyone else, so
// they file requisitions like any other holder (their requests route to the
// Approving Officer of their section, then division). Management and the System
// Administrator do not file. Fulfilling is the custodian's job, so a custodian
// never fulfils what they filed themselves: another custodian does, or - for a
// custodian's own request only - the System Administrator.
describe('Property roles file requisitions (e2e)', () => {
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

  const makeUser = async (
    key: string,
    role: UserRole,
    division: string,
    hash: string,
  ) => {
    users[key] = await userRepo.save(
      userRepo.create({
        employeeId: `PR-${key}-${tag}`,
        firstName: 'PR',
        lastName: key,
        email: `pr.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash: hash,
        role,
        division,
        officeOrSection: `PR ${key} ${tag}`,
      }),
    );
  };

  const fixedBody = (what: string) => ({
    requisitionType: 'new',
    justification: 'Needed for the section and not in stock right now',
    requiredDate: inAWeek(),
    items: [
      {
        assetType: AssetType.FIXED,
        assetClass: AssetClass.SEP,
        itemDescription: `${what} ${tag}`,
        quantity: 1,
      },
    ],
  });

  const file = (who: string, what: string) =>
    request(server())
      .post('/api/v1/requisitions')
      .set(auth(who))
      .send(fixedBody(what));

  const approve = (id: string) =>
    request(server())
      .post(`/api/v1/requisitions/${id}/approve`)
      .set(auth('APPROVER'))
      .send({ comments: 'Approved' })
      .expect(200);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const psm = `Property and Supply ${tag}`;
    // The Property and Supply Management division has its Approving Officer...
    await makeUser('APPROVER', UserRole.SUPERVISOR, psm, hash);
    await makeUser('PC', UserRole.PROPERTY_CUSTODIAN, psm, hash);
    await makeUser('PC2', UserRole.PROPERTY_CUSTODIAN, psm, hash);
    await makeUser('PO', UserRole.PROPERTY_OFFICER, psm, hash);
    // ...and a division that has none.
    await makeUser(
      'ORPHAN_PC',
      UserRole.PROPERTY_CUSTODIAN,
      `No Approver ${tag}`,
      hash,
    );
    await makeUser('MGMT', UserRole.MANAGEMENT, psm, hash);
    await makeUser('ADMIN', UserRole.SYSTEM_ADMIN, psm, hash);
    await makeUser('EMP', UserRole.EMPLOYEE, psm, hash);
    await makeUser('IT1', UserRole.IT_PERSONNEL, psm, hash);
    await makeUser('IT2', UserRole.IT_PERSONNEL, psm, hash);
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

  describe('filing', () => {
    it.each(['PC', 'PO'])(
      'the %s files a requisition, routed to the Approving Officer of their division',
      async (who) => {
        const res = await file(who, `${who} chair`).expect(201);

        expect(res.body.data).toMatchObject({
          status: 'pending_supervisor',
          supervisorId: users.APPROVER.id,
          requestedById: users[who].id,
        });
      },
    );

    it('says so when the division has no Approving Officer', async () => {
      const res = await file('ORPHAN_PC', 'orphan chair').expect(400);

      expect(JSON.stringify(res.body)).toMatch(/No supervisor is configured/i);
    });

    it.each(['MGMT', 'ADMIN'])('the %s cannot file (403)', async (who) => {
      await file(who, `${who} chair`).expect(403);
    });

    it('the Property Custodian can read the catalogue the form picks from', async () => {
      await request(server())
        .get('/api/v1/assets/catalogue/items')
        .set(auth('PC'))
        .expect(200);
    });

    it('they follow it under My Requisitions', async () => {
      const mine = await request(server())
        .get('/api/v1/requisitions/mine')
        .set(auth('PC'))
        .expect(200);

      expect(
        (mine.body.data.data as Array<{ requestedById: string }>).every(
          (r) => r.requestedById === users.PC.id,
        ),
      ).toBe(true);
      expect(mine.body.data.total).toBeGreaterThan(0);
    });
  });

  describe('fulfilling what a custodian filed', () => {
    let ownId: string;
    let employeeId: string;

    beforeAll(async () => {
      ownId = (await file('PC', 'own desk').expect(201)).body.data.id as string;
      employeeId = (await file('EMP', 'employee desk').expect(201)).body.data
        .id as string;
      await approve(ownId);
      await approve(employeeId);
    });

    const queueOf = async (who: string) =>
      (
        (
          await request(server())
            .get('/api/v1/requisitions?limit=200')
            .set(auth(who))
            .expect(200)
        ).body.data.data as Array<{ id: string }>
      ).map((r) => r.id);

    it("leaves it out of the custodian's own fulfilment queue, and keeps the employee's in", async () => {
      const queue = await queueOf('PC2');
      expect(queue).toContain(employeeId);
      expect(queue).toContain(ownId); // another custodian sees it

      const own = await queueOf('PC');
      expect(own).toContain(employeeId);
      expect(own).not.toContain(ownId);
    });

    it('refuses the custodian fulfilling or holding their own requisition (403)', async () => {
      await request(server())
        .post(`/api/v1/requisitions/${ownId}/fulfill`)
        .set(auth('PC'))
        .send({})
        .expect(403);
      await request(server())
        .post(`/api/v1/requisitions/${ownId}/hold`)
        .set(auth('PC'))
        .send({ reason: 'No stock at the moment' })
        .expect(403);
    });

    it('refuses the System Administrator on an employee requisition (403)', async () => {
      await request(server())
        .post(`/api/v1/requisitions/${employeeId}/fulfill`)
        .set(auth('ADMIN'))
        .send({})
        .expect(403);
    });

    it("lists the custodian's own requisition for the System Administrator, and only that kind", async () => {
      const res = await request(server())
        .get('/api/v1/requisitions/fulfilment-fallback')
        .set(auth('ADMIN'))
        .expect(200);
      const ids = (res.body.data.data as Array<{ id: string }>).map(
        (r) => r.id,
      );

      expect(ids).toContain(ownId);
      expect(ids).not.toContain(employeeId);
    });

    it('keeps the fallback list from everyone but the System Administrator', async () => {
      await request(server())
        .get('/api/v1/requisitions/fulfilment-fallback')
        .set(auth('PC'))
        .expect(403);
    });

    it('lets the System Administrator fulfil it', async () => {
      const res = await request(server())
        .post(`/api/v1/requisitions/${ownId}/fulfill`)
        .set(auth('ADMIN'))
        .send({ notes: 'Issued by the administrator: no second custodian' })
        .expect(200);

      expect(res.body.data.status).toBe('fulfilled');
    });

    it("lets another custodian fulfil a custodian's requisition", async () => {
      const second = (await file('PC', 'second desk').expect(201)).body.data
        .id as string;
      await approve(second);

      const res = await request(server())
        .post(`/api/v1/requisitions/${second}/fulfill`)
        .set(auth('PC2'))
        .send({})
        .expect(200);

      expect(res.body.data.status).toBe('fulfilled');
    });
  });

  // The same segregation of duties holds for IT Personnel, who fulfil the ICT items
  // the Property Custodian cannot touch: IT never fulfils their own ICT request.
  describe('fulfilling what IT Personnel filed (ICT items)', () => {
    let ownId: string;
    let employeeId: string;

    const fileIct = (who: string, what: string) =>
      request(server())
        .post('/api/v1/requisitions')
        .set(auth(who))
        .send({
          ...fixedBody(what),
          items: [
            {
              assetType: AssetType.ICT,
              assetClass: AssetClass.SEP,
              itemDescription: `${what} ${tag}`,
              quantity: 1,
            },
          ],
        });

    const queueOf = async (who: string) =>
      (
        (
          await request(server())
            .get('/api/v1/requisitions?limit=200')
            .set(auth(who))
            .expect(200)
        ).body.data.data as Array<{ id: string }>
      ).map((r) => r.id);

    beforeAll(async () => {
      ownId = (await fileIct('IT1', 'own laptop').expect(201)).body.data
        .id as string;
      employeeId = (await fileIct('EMP', 'employee laptop').expect(201)).body
        .data.id as string;
      await approve(ownId);
      await approve(employeeId);
    });

    it("leaves it out of the IT custodian's own queue, and keeps the employee's in", async () => {
      const own = await queueOf('IT1');
      expect(own).toContain(employeeId);
      expect(own).not.toContain(ownId);

      expect(await queueOf('IT2')).toContain(ownId); // another IT sees it
    });

    it('refuses the IT custodian fulfilling or holding their own requisition (403)', async () => {
      await request(server())
        .post(`/api/v1/requisitions/${ownId}/fulfill`)
        .set(auth('IT1'))
        .send({})
        .expect(403);
      await request(server())
        .post(`/api/v1/requisitions/${ownId}/hold`)
        .set(auth('IT1'))
        .send({ reason: 'No stock at the moment' })
        .expect(403);
    });

    it('lists it for the System Administrator, and not the employee ICT requisition', async () => {
      const res = await request(server())
        .get('/api/v1/requisitions/fulfilment-fallback')
        .set(auth('ADMIN'))
        .expect(200);
      const ids = (res.body.data.data as Array<{ id: string }>).map(
        (r) => r.id,
      );

      expect(ids).toContain(ownId);
      expect(ids).not.toContain(employeeId);
      await request(server())
        .post(`/api/v1/requisitions/${employeeId}/fulfill`)
        .set(auth('ADMIN'))
        .send({})
        .expect(403);
    });

    it('keeps the Property Custodian out of ICT requisitions, whoever filed them', async () => {
      await request(server())
        .post(`/api/v1/requisitions/${ownId}/fulfill`)
        .set(auth('PC'))
        .send({})
        .expect(403);
    });

    it("lets another IT custodian, then the System Administrator, fulfil an IT custodian's requisition", async () => {
      const res = await request(server())
        .post(`/api/v1/requisitions/${ownId}/fulfill`)
        .set(auth('IT2'))
        .send({})
        .expect(200);
      expect(res.body.data.status).toBe('fulfilled');

      const another = (await fileIct('IT1', 'second laptop').expect(201)).body
        .data.id as string;
      await approve(another);
      const byAdmin = await request(server())
        .post(`/api/v1/requisitions/${another}/fulfill`)
        .set(auth('ADMIN'))
        .send({ notes: 'Issued by the administrator: no second IT custodian' })
        .expect(200);
      expect(byAdmin.body.data.status).toBe('fulfilled');
    });
  });
});
