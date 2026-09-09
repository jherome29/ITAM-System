import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindManyOptions } from 'typeorm';
import { AdminService } from './admin.service';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigService } from '../system-config/system-config.service';
import { UserRole } from '../../../packages/shared/src/enums';

type Where = Record<string, unknown> | undefined;
const whereOf = (opts?: FindManyOptions): Where => opts?.where as Where;

describe('AdminService.getDashboardStats', () => {
  let service: AdminService;

  const userQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      { role: 'employee', count: '6' },
      { role: 'system_admin', count: '1' },
    ]),
  };
  const assetQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(5),
  };

  const usersRepo = {
    count: jest.fn((opts?: FindManyOptions) => {
      const where = whereOf(opts);
      if (!where) return Promise.resolve(10);
      if ('isActive' in where) return Promise.resolve(7);
      if ('lockedUntil' in where) return Promise.resolve(2);
      return Promise.resolve(0);
    }),
    createQueryBuilder: jest.fn(() => userQb),
  };
  const requisitionsRepo = {
    count: jest.fn((opts?: FindManyOptions) => {
      const where = whereOf(opts) ?? {};
      return Promise.resolve('slaDeadline' in where ? 3 : 9);
    }),
  };
  const assetsRepo = {
    count: jest.fn((opts?: FindManyOptions) =>
      Promise.resolve(whereOf(opts) ? 1200 : 2000),
    ),
    createQueryBuilder: jest.fn(() => assetQb),
  };
  const auditRepo = {
    count: jest.fn((opts?: FindManyOptions) => {
      const where = whereOf(opts) ?? {};
      return Promise.resolve('action' in where ? 4 : 42);
    }),
  };
  const systemConfig = { getDefaultReorderLevel: jest.fn(() => 5) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(UserEntity), useValue: usersRepo },
        {
          provide: getRepositoryToken(RequisitionEntity),
          useValue: requisitionsRepo,
        },
        { provide: getRepositoryToken(AssetEntity), useValue: assetsRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: auditRepo },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  it('aggregates user counts and derives inactive from total − active', async () => {
    const { users } = await service.getDashboardStats();
    expect(users).toMatchObject({
      total: 10,
      active: 7,
      inactive: 3,
      locked: 2,
    });
  });

  it('zero-fills every role in byRole and overlays the grouped counts', async () => {
    const { users } = await service.getDashboardStats();
    expect(Object.keys(users.byRole).sort()).toEqual(
      Object.values(UserRole).sort(),
    );
    expect(users.byRole[UserRole.EMPLOYEE]).toBe(6);
    expect(users.byRole[UserRole.SYSTEM_ADMIN]).toBe(1);
    expect(users.byRole[UserRole.SUPERVISOR]).toBe(0);
  });

  it('reports pending-supervisor requisitions and the SLA-breached subset', async () => {
    const { requisitions } = await service.getDashboardStats();
    expect(requisitions).toEqual({ pendingSupervisor: 9, slaBreached: 3 });
  });

  it('reports asset totals plus the low-stock count from the query builder', async () => {
    const { assets } = await service.getDashboardStats();
    expect(assets).toEqual({ total: 2000, available: 1200, lowStock: 5 });
    expect(systemConfig.getDefaultReorderLevel).toHaveBeenCalled();
  });

  it('splits today’s audit volume into failed logins and all events', async () => {
    const { audit } = await service.getDashboardStats();
    expect(audit).toEqual({ failedLoginsToday: 4, eventsToday: 42 });
  });

  it('stamps generatedAt as an ISO-8601 timestamp', async () => {
    const { generatedAt } = await service.getDashboardStats();
    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
  });
});
