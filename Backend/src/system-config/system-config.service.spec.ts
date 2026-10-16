import { BadRequestException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SystemConfigService } from './system-config.service';
import { SystemConfigEntity } from './entities/system-config.entity';
import { CONFIG_KEYS } from './system-config.keys';
import {
  SLA_APPROVAL_HOURS,
  DEFAULT_REORDER_LEVEL,
  USEFUL_LIFE_YEARS,
  MAX_LOGIN_ATTEMPTS,
  REPEAT_REPAIR_LIMIT,
  FORM_ENTITY_NAME,
} from '../../../packages/shared/src/constants';
import { AssetClass } from '../../../packages/shared/src/enums';

describe('SystemConfigService — getters + fallback', () => {
  let service: SystemConfigService;
  const rows: { key: string; value: unknown }[] = [];
  const mockRepo = {
    find: jest.fn(() => Promise.resolve(rows)),
    save: jest.fn(),
  };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: getRepositoryToken(SystemConfigEntity), useValue: mockRepo },
      ],
    }).compile();
    const s = module.get(SystemConfigService);
    await s.onModuleInit();
    return s;
  };

  afterEach(() => {
    rows.length = 0;
    jest.clearAllMocks();
  });

  it('serves a stored value when the row is present and valid', async () => {
    rows.push({ key: CONFIG_KEYS.SLA_APPROVAL_HOURS, value: 12 });
    service = await build();
    expect(service.getSlaApprovalHours()).toBe(12);
  });

  it('falls back to the shared constant when the row is absent', async () => {
    service = await build();
    expect(service.getSlaApprovalHours()).toBe(SLA_APPROVAL_HOURS);
    expect(service.getDefaultReorderLevel()).toBe(DEFAULT_REORDER_LEVEL);
    expect(service.getMaxLoginAttempts()).toBe(MAX_LOGIN_ATTEMPTS);
    expect(service.getUsefulLifeYears()).toEqual(USEFUL_LIFE_YEARS);
    expect(service.getRepeatRepairLimit()).toBe(REPEAT_REPAIR_LIMIT);
  });

  it('serves a stored repeat-repair limit, and ignores one below 2', async () => {
    rows.push({ key: CONFIG_KEYS.REPEAT_REPAIR_LIMIT, value: 4 });
    service = await build();
    expect(service.getRepeatRepairLimit()).toBe(4);

    rows.length = 0;
    rows.push({ key: CONFIG_KEYS.REPEAT_REPAIR_LIMIT, value: 1 });
    service = await build();
    expect(service.getRepeatRepairLimit()).toBe(REPEAT_REPAIR_LIMIT);
  });

  it('falls back to the constant when a stored scalar fails validation', async () => {
    rows.push({ key: CONFIG_KEYS.SLA_APPROVAL_HOURS, value: -3 });
    rows.push({ key: CONFIG_KEYS.DEFAULT_REORDER_LEVEL, value: 'nope' });
    service = await build();
    expect(service.getSlaApprovalHours()).toBe(SLA_APPROVAL_HOURS);
    expect(service.getDefaultReorderLevel()).toBe(DEFAULT_REORDER_LEVEL);
  });

  it('falls back to the default useful-life map when a class is missing or non-positive', async () => {
    rows.push({
      key: CONFIG_KEYS.USEFUL_LIFE_YEARS,
      value: { PPE: 7, SEP: 0 },
    });
    service = await build();
    expect(service.getUsefulLifeYears()).toEqual(USEFUL_LIFE_YEARS);
  });

  it('serves a valid stored useful-life map', async () => {
    rows.push({
      key: CONFIG_KEYS.USEFUL_LIFE_YEARS,
      value: { PPE: 7, SEP: 4, IES: 2 },
    });
    service = await build();
    expect(service.getUsefulLifeYears()[AssetClass.PPE]).toBe(7);
    expect(service.getUsefulLifeYears()[AssetClass.IES]).toBe(2);
  });

  // The official forms used to print "Entity Name" and "Fund Cluster: General
  // Fund" as fixed text. The cluster was an assumption nobody at CICC had made,
  // so it is a setting now and blank until the Master Admin fills it in.
  describe('official-form identity', () => {
    it('defaults to the CICC name and no fund cluster', async () => {
      service = await build();
      expect(service.getEntityName()).toBe(FORM_ENTITY_NAME);
      expect(service.getFundCluster()).toBe('');
    });

    it('serves a stored entity name and fund cluster, trimmed', async () => {
      rows.push({
        key: CONFIG_KEYS.ENTITY_NAME,
        value: '  CICC Central Office ',
      });
      rows.push({
        key: CONFIG_KEYS.FUND_CLUSTER,
        value: ' 01 Regular Agency Fund ',
      });
      service = await build();
      expect(service.getEntityName()).toBe('CICC Central Office');
      expect(service.getFundCluster()).toBe('01 Regular Agency Fund');
    });

    it('ignores a stored value of the wrong type or an empty entity name', async () => {
      rows.push({ key: CONFIG_KEYS.ENTITY_NAME, value: '   ' });
      rows.push({ key: CONFIG_KEYS.FUND_CLUSTER, value: 42 });
      service = await build();
      expect(service.getEntityName()).toBe(FORM_ENTITY_NAME);
      expect(service.getFundCluster()).toBe('');
    });
  });
});

describe('SystemConfigService — reload() failure is non-fatal', () => {
  const mockRepo = {
    find: jest.fn(() =>
      Promise.reject(new Error('relation "system_config" does not exist')),
    ),
    save: jest.fn(),
  };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: getRepositoryToken(SystemConfigEntity), useValue: mockRepo },
      ],
    }).compile();
    return module.get(SystemConfigService);
  };

  beforeEach(() => {
    // Silence the expected "config unreadable" error log for this path.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('onModuleInit() resolves (does not throw) when repo.find() rejects', async () => {
    const s = await build();
    await expect(s.onModuleInit()).resolves.toBeUndefined();
  });

  it('getters return the shared constants when the cache never loaded', async () => {
    const s = await build();
    await s.onModuleInit();
    expect(s.getSlaApprovalHours()).toBe(SLA_APPROVAL_HOURS);
    expect(s.getDefaultReorderLevel()).toBe(DEFAULT_REORDER_LEVEL);
    expect(s.getMaxLoginAttempts()).toBe(MAX_LOGIN_ATTEMPTS);
    expect(s.getUsefulLifeYears()).toEqual(USEFUL_LIFE_YEARS);
  });
});

describe('SystemConfigService — update() + getAll()', () => {
  let service: SystemConfigService;
  const rows: { key: string; value: unknown }[] = [];
  const mockRepo = {
    find: jest.fn(() => Promise.resolve(rows)),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
  };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: getRepositoryToken(SystemConfigEntity), useValue: mockRepo },
      ],
    }).compile();
    const s = module.get(SystemConfigService);
    await s.onModuleInit();
    return s;
  };

  afterEach(() => {
    rows.length = 0;
    jest.clearAllMocks();
  });

  it('rejects an unknown key', async () => {
    service = await build();
    await expect(service.update('nope', 5, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range scalar', async () => {
    service = await build();
    await expect(
      service.update(CONFIG_KEYS.SLA_APPROVAL_HOURS, 0, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a repeat-repair limit below 2', async () => {
    service = await build();
    await expect(
      service.update(CONFIG_KEYS.REPEAT_REPAIR_LIMIT, 1, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a useful-life map missing a class', async () => {
    service = await build();
    await expect(
      service.update(
        CONFIG_KEYS.USEFUL_LIFE_YEARS,
        { PPE: 5, SEP: 3 },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty or over-long entity name and an over-long fund cluster', async () => {
    service = await build();
    await expect(
      service.update(CONFIG_KEYS.ENTITY_NAME, '   ', 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update(CONFIG_KEYS.ENTITY_NAME, 'x'.repeat(151), 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update(CONFIG_KEYS.FUND_CLUSTER, 'x'.repeat(61), 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update(CONFIG_KEYS.FUND_CLUSTER, 5, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('stores the trimmed identity, and lets the fund cluster be cleared', async () => {
    service = await build();
    await service.update(CONFIG_KEYS.ENTITY_NAME, '  CICC  ', 'admin-1');
    await service.update(CONFIG_KEYS.FUND_CLUSTER, ' 01 ', 'admin-1');
    expect(service.getEntityName()).toBe('CICC');
    expect(service.getFundCluster()).toBe('01');

    await service.update(CONFIG_KEYS.FUND_CLUSTER, '', 'admin-1');
    expect(service.getFundCluster()).toBe('');
  });

  it('persists a valid value and reflects it immediately via the getter', async () => {
    service = await build();
    await service.update(CONFIG_KEYS.SLA_APPROVAL_HOURS, 36, 'admin-1');
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: CONFIG_KEYS.SLA_APPROVAL_HOURS,
        value: 36,
        updatedBy: 'admin-1',
      }),
    );
    expect(service.getSlaApprovalHours()).toBe(36);
  });

  it('getAll() returns the effective snapshot (stored over default)', async () => {
    rows.push({ key: CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, value: 8 });
    service = await build();
    const snap = service.getAll();
    expect(snap.maxLoginAttempts).toBe(8);
    expect(snap.slaApprovalHours).toBe(SLA_APPROVAL_HOURS);
    expect(snap.usefulLifeYears).toEqual(USEFUL_LIFE_YEARS);
  });
});

describe('SystemConfigService — getMeta() provenance', () => {
  let service: SystemConfigService;
  const rows: {
    key: string;
    value: unknown;
    updatedAt?: Date;
    updatedBy?: string | null;
  }[] = [];
  const mockRepo = {
    find: jest.fn(() => Promise.resolve(rows)),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
  };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: getRepositoryToken(SystemConfigEntity), useValue: mockRepo },
      ],
    }).compile();
    const s = module.get(SystemConfigService);
    await s.onModuleInit();
    return s;
  };

  afterEach(() => {
    rows.length = 0;
    jest.clearAllMocks();
  });

  it('reports null/null for a key that has never been persisted', async () => {
    service = await build();
    expect(service.getMeta()[CONFIG_KEYS.SLA_APPROVAL_HOURS]).toEqual({
      updatedAt: null,
      updatedBy: null,
    });
  });

  it('surfaces the stored row updatedAt (ISO) and updatedBy', async () => {
    rows.push({
      key: CONFIG_KEYS.SLA_APPROVAL_HOURS,
      value: 12,
      updatedAt: new Date('2026-09-01T08:30:00.000Z'),
      updatedBy: 'admin-9',
    });
    service = await build();
    expect(service.getMeta()[CONFIG_KEYS.SLA_APPROVAL_HOURS]).toEqual({
      updatedAt: '2026-09-01T08:30:00.000Z',
      updatedBy: 'admin-9',
    });
  });

  it('records the caller and a fresh timestamp after update()', async () => {
    service = await build();
    await service.update(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, 7, 'admin-3');
    const meta = service.getMeta()[CONFIG_KEYS.MAX_LOGIN_ATTEMPTS];
    expect(meta.updatedBy).toBe('admin-3');
    expect(meta.updatedAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(meta.updatedAt as string))).toBe(false);
  });

  it('getAll().meta covers every config key', async () => {
    service = await build();
    const keys = Object.values(CONFIG_KEYS);
    expect(Object.keys(service.getAll().meta).sort()).toEqual([...keys].sort());
  });
});
