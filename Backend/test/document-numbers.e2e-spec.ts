import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { createTestApp } from './create-test-app';
import { UserEntity } from '../src/users/entities/user.entity';
import { AssetEntity } from '../src/assets/entities/asset.entity';
import { ReportsService } from '../src/reports/reports.service';
import {
  AssetClass,
  AssetCondition,
  AssetStatus,
  AssetType,
  OfficialFormType,
  UserRole,
} from '../../packages/shared/src/enums';

// Running numbers on the COA forms (schema 016). The unit tests mock the
// transaction; what they cannot show is that two forms never share a number,
// that each series counts on its own, and that a form which fails to generate
// gives its number back so the series has no hole.
describe('Form document numbers (e2e)', () => {
  let app: INestApplication<App>;
  let reports: ReportsService;
  let dataSource: DataSource;
  let userRepo: Repository<UserEntity>;
  let assetRepo: Repository<AssetEntity>;

  const tag = randomUUID().slice(0, 8);
  const year = new Date().getFullYear();
  let admin: UserEntity;
  let holder: UserEntity;
  let held: AssetEntity;
  let unheld: AssetEntity;

  const generate = (formType: OfficialFormType, assetId: string, extra = {}) =>
    reports.generateFormRecord(
      { formType, assetId, ...extra },
      admin.id,
      UserRole.SYSTEM_ADMIN,
      '127.0.0.1',
    );

  const lastValue = async (series: string): Promise<number> => {
    const rows: Array<{ last_value: number }> = await dataSource.query(
      'SELECT last_value FROM document_counters WHERE series = $1 AND year = $2',
      [series, year],
    );
    return rows[0]?.last_value ?? 0;
  };

  const makeUser = (key: string, role: UserRole) =>
    userRepo.save(
      userRepo.create({
        employeeId: `DN-${key}-${tag}`,
        firstName: 'DN',
        lastName: key,
        email: `dn.${key.toLowerCase()}.${tag}@cicc.gov.ph`,
        passwordHash: 'not-used',
        role,
        division: `DN Division ${tag}`,
        officeOrSection: `DN ${key} ${tag}`,
      }),
    );

  const makeAsset = (key: string, custodianId: string | null) =>
    assetRepo.save(
      assetRepo.create({
        itemDescription: `DN ${key} ${tag}`,
        assetClass: AssetClass.PPE,
        assetType: AssetType.ICT,
        condition: AssetCondition.SERVICEABLE,
        status: custodianId ? AssetStatus.ISSUED : AssetStatus.AVAILABLE,
        custodianId,
        acquisitionDate: new Date(),
        propertyNumber: `DN-PROP-${key}-${tag}`,
      }),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await createTestApp(moduleFixture);
    reports = moduleFixture.get(ReportsService);
    dataSource = moduleFixture.get(DataSource);
    userRepo = moduleFixture.get(getRepositoryToken(UserEntity));
    assetRepo = moduleFixture.get(getRepositoryToken(AssetEntity));

    admin = await makeUser('ADMIN', UserRole.SYSTEM_ADMIN);
    holder = await makeUser('HOLDER', UserRole.EMPLOYEE);
    held = await makeAsset('held', holder.id);
    unheld = await makeAsset('unheld', null);
  });

  afterAll(async () => {
    await app.close();
  });

  it('numbers forms of one series one after another, and stores the number with the form', async () => {
    const before = await lastValue('PAR');

    const first = await generate(OfficialFormType.PAR, held.id);
    const second = await generate(OfficialFormType.PAR, held.id);

    expect(first.form.documentNumber).toBe(
      `PAR-${year}-${String(before + 1).padStart(4, '0')}`,
    );
    expect(second.form.documentNumber).toBe(
      `PAR-${year}-${String(before + 2).padStart(4, '0')}`,
    );
    const stored: Array<{ document_number: string }> = await dataSource.query(
      'SELECT document_number FROM generated_forms WHERE id = $1',
      [second.form.id],
    );
    expect(stored[0].document_number).toBe(second.form.documentNumber);
  });

  it('gives each series its own count', async () => {
    const ptrBefore = await lastValue('PTR');
    const parBefore = await lastValue('PAR');

    const ptr = await generate(OfficialFormType.PTR, held.id, {
      targetOffice: 'Records Section',
    });

    expect(ptr.form.documentNumber).toBe(
      `PTR-${year}-${String(ptrBefore + 1).padStart(4, '0')}`,
    );
    expect(await lastValue('PAR')).toBe(parBefore);
  });

  it('hands out distinct numbers to forms generated at the same moment', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => generate(OfficialFormType.PAR, held.id)),
    );

    const numbers = results.map((r) => r.form.documentNumber);
    expect(new Set(numbers).size).toBe(6);
  });

  it('gives a failed form its number back, leaving no hole in the series', async () => {
    const before = await lastValue('PAR');

    // An asset nobody holds has no custodian to acknowledge it.
    await expect(generate(OfficialFormType.PAR, unheld.id)).rejects.toThrow(
      NotFoundException,
    );

    expect(await lastValue('PAR')).toBe(before);
    const next = await generate(OfficialFormType.PAR, held.id);
    expect(next.form.documentNumber).toBe(
      `PAR-${year}-${String(before + 1).padStart(4, '0')}`,
    );
  });

  it('does not number a periodic report', async () => {
    const counters: Array<{ series: string }> = await dataSource.query(
      "SELECT series FROM document_counters WHERE series = 'RPCI'",
    );
    const { form } = await reports.generateFormRecord(
      { formType: OfficialFormType.RPCI },
      admin.id,
      UserRole.SYSTEM_ADMIN,
      '127.0.0.1',
    );

    expect(form.documentNumber).toBeNull();
    expect(counters).toEqual([]);
  });
});
