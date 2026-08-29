import { BadRequestException } from '@nestjs/common';
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
} from '../../../packages/shared/src/constants';
import { AssetClass } from '../../../packages/shared/src/enums';

describe('SystemConfigService — getters + fallback', () => {
  let service: SystemConfigService;
  const rows: { key: string; value: unknown }[] = [];
  const mockRepo = { find: jest.fn(async () => rows), save: jest.fn() };

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
  });

  it('falls back to the constant when a stored scalar fails validation', async () => {
    rows.push({ key: CONFIG_KEYS.SLA_APPROVAL_HOURS, value: -3 });
    rows.push({ key: CONFIG_KEYS.DEFAULT_REORDER_LEVEL, value: 'nope' });
    service = await build();
    expect(service.getSlaApprovalHours()).toBe(SLA_APPROVAL_HOURS);
    expect(service.getDefaultReorderLevel()).toBe(DEFAULT_REORDER_LEVEL);
  });

  it('falls back to the default useful-life map when a class is missing or non-positive', async () => {
    rows.push({ key: CONFIG_KEYS.USEFUL_LIFE_YEARS, value: { PPE: 7, SEP: 0 } });
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
});

describe('SystemConfigService — update() + getAll()', () => {
  let service: SystemConfigService;
  const rows: { key: string; value: unknown }[] = [];
  const mockRepo = {
    find: jest.fn(async () => rows),
    save: jest.fn(async (row) => row),
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

  it('rejects a useful-life map missing a class', async () => {
    service = await build();
    await expect(
      service.update(CONFIG_KEYS.USEFUL_LIFE_YEARS, { PPE: 5, SEP: 3 }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
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
