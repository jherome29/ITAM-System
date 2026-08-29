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
