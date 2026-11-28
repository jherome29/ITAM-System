import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createTestApp } from './create-test-app';
import { UserEntity } from '../src/users/entities/user.entity';
import { AssetEntity } from '../src/assets/entities/asset.entity';
import { AuditLogEntity } from '../src/audit/entities/audit-log.entity';
import {
  AssetClass,
  AssetCondition,
  AssetStatus,
  AssetType,
  AuditAction,
  UserRole,
} from '../../packages/shared/src/enums';

jest.setTimeout(30000);

// GET /audit/record/:id used to return ANY record's history to IT and the
// property roles. Account activity is logged against the user's own id, so an
// IT user could read any employee's login history (with IP address and
// user-agent) through it, bypassing the admin-only GET /audit/user/:id. Now a
// custodian may read only the history of an asset inside their own asset-type
// scope (CLAUDE.md §8.3).
describe('Audit record history is scoped (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<UserEntity>;
  let assetRepo: Repository<AssetEntity>;
  let auditRepo: Repository<AuditLogEntity>;
  let jwt: JwtService;

  // Unique per run: the e2e database is shared by every spec file.
  const tag = randomUUID().slice(0, 8);
  const placeholder = '$2b$12$placeholder.hash.not.used.by.this.test.suite';
  const users: Record<string, UserEntity> = {};
  const tokens: Record<string, string> = {};
  const assets: Record<string, AssetEntity> = {};
  const LOGIN_IP = '203.0.113.77';

  const server = () => app.getHttpServer();
  const history = (key: string, recordId: string) =>
    request(server())
      .get(`/api/v1/audit/record/${recordId}`)
      .set('Authorization', `Bearer ${tokens[key]}`);

  const makeUser = async (key: string, role: UserRole) => {
    users[key] = await userRepo.save(
      userRepo.create({
        employeeId: `AS-${key}-${tag}`,
        firstName: 'AS',
        lastName: key,
        email: `as.${key.toLowerCase()}.${tag}@example.invalid`,
        passwordHash: placeholder,
        role,
        division: `AS Division ${tag}`,
        officeOrSection: `AS Section ${tag}`,
      }),
    );
    // Signed directly (not via /auth/login) so this spec adds nothing to the
    // login throttle window shared by every e2e file.
    tokens[key] = jwt.sign(
      {
        sub: users[key].id,
        employeeId: users[key].employeeId,
        role,
        tokenVersion: users[key].tokenVersion ?? 0,
      },
      { secret: process.env.JWT_SECRET, expiresIn: '5m' },
    );
  };

  const makeAsset = (key: string, assetType: AssetType) =>
    assetRepo
      .save(
        assetRepo.create({
          itemDescription: `AS ${key} ${tag}`,
          assetClass: AssetClass.PPE,
          assetType,
          condition: AssetCondition.SERVICEABLE,
          status: AssetStatus.AVAILABLE,
          acquisitionDate: new Date(),
          propertyNumber: `AS-PROP-${key}-${tag}`,
        }),
      )
      .then((a) => (assets[key] = a));

  const logRow = (
    recordId: string,
    recordType: string,
    action: AuditAction,
    actor: UserEntity,
    ipAddress: string,
  ) =>
    auditRepo.save(
      auditRepo.create({
        userId: actor.id,
        userRole: actor.role,
        action,
        affectedRecordId: recordId,
        affectedRecordType: recordType,
        ipAddress,
      }),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    assetRepo = moduleFixture.get(getRepositoryToken(AssetEntity));
    auditRepo = moduleFixture.get(getRepositoryToken(AuditLogEntity));
    jwt = moduleFixture.get(JwtService);

    await makeUser('EMP', UserRole.EMPLOYEE);
    await makeUser('IT', UserRole.IT_PERSONNEL);
    await makeUser('PC', UserRole.PROPERTY_CUSTODIAN);
    await makeUser('ADMIN', UserRole.SYSTEM_ADMIN);
    await makeAsset('ICT', AssetType.ICT);
    await makeAsset('FIXED', AssetType.FIXED);

    // The employee's own login trail (record id = the user's id) …
    await logRow(
      users.EMP.id,
      'users',
      AuditAction.USER_LOGIN,
      users.EMP,
      LOGIN_IP,
    );
    // … and one lifecycle entry on each asset.
    await logRow(
      assets.ICT.id,
      'assets',
      AuditAction.ASSET_ISSUED,
      users.IT,
      '203.0.113.5',
    );
    await logRow(
      assets.FIXED.id,
      'assets',
      AuditAction.ASSET_ISSUED,
      users.PC,
      '203.0.113.6',
    );
  });

  afterAll(async () => {
    // audit_logs is append-only and has no FK to users, so the rows stay.
    for (const a of Object.values(assets)) await assetRepo.delete(a.id);
    for (const u of Object.values(users)) await userRepo.delete(u.id);
    if (app) await app.close();
  });

  it("IT reads the history of an ICT asset (the asset page's history panel)", async () => {
    const res = await history('IT', assets.ICT.id).expect(200);
    const rows = res.body.data as { action: string }[];
    expect(rows.map((r) => r.action)).toContain(AuditAction.ASSET_ISSUED);
  });

  it("IT can NOT read an employee's login history through the record route (was: 200 with the IP address)", async () => {
    const res = await history('IT', users.EMP.id).expect(403);
    expect(JSON.stringify(res.body)).not.toContain(LOGIN_IP);
  });

  it('the documented admin-only per-account route is still 403 for IT', async () => {
    await request(server())
      .get(`/api/v1/audit/user/${users.EMP.id}`)
      .set('Authorization', `Bearer ${tokens.IT}`)
      .expect(403);
  });

  it('IT can NOT read the history of a Fixed asset (outside the ICT scope)', async () => {
    await history('IT', assets.FIXED.id).expect(403);
  });

  it('the property custodian reads a Fixed asset but not an ICT one', async () => {
    await history('PC', assets.FIXED.id).expect(200);
    await history('PC', assets.ICT.id).expect(403);
  });

  it("the System Administrator can still read any record, including an account's login trail", async () => {
    const res = await history('ADMIN', users.EMP.id).expect(200);
    const rows = res.body.data as { ipAddress: string }[];
    expect(rows.map((r) => r.ipAddress)).toContain(LOGIN_IP);
  });

  it('an employee is refused outright by the role guard', async () => {
    await history('EMP', assets.ICT.id).expect(403);
  });
});
