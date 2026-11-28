import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindManyOptions } from 'typeorm';
import { AdminService } from './admin.service';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigService } from '../system-config/system-config.service';
import { AssetRequestsService } from '../asset-requests/asset-requests.service';
import { AssetRepairsService } from '../assets/asset-repairs.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import {
  ASSIGNABLE_USER_ROLES,
  AuditAction,
  UserRole,
} from '../../../packages/shared/src/enums';
import { AUDIT_REASON_REFRESH_TOKEN_REUSE } from '../audit/audit-reasons';

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
  const auditQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(4),
  };
  const auditRepo = {
    // All of today's events; failed logins go through the query builder.
    count: jest.fn(() => Promise.resolve(42)),
    createQueryBuilder: jest.fn(() => auditQb),
  };
  const systemConfig = { getDefaultReorderLevel: jest.fn(() => 5) };
  // The three queues the administrator is the fallback decider for. The dashboard asks the same services the
  // admin screens ask, so its count cannot drift from the list (CLAUDE.md Module 4).
  const assetRequests = { findQueue: jest.fn() };
  const repairs = { list: jest.fn() };
  const requisitions = { fulfilmentFallback: jest.fn() };
  const admin = { id: 'admin-1', role: UserRole.SYSTEM_ADMIN } as UserEntity;

  beforeEach(async () => {
    assetRequests.findQueue.mockResolvedValue([]);
    repairs.list.mockResolvedValue([]);
    requisitions.fulfilmentFallback.mockResolvedValue({ data: [], total: 0 });
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
        { provide: AssetRequestsService, useValue: assetRequests },
        { provide: AssetRepairsService, useValue: repairs },
        { provide: RequisitionsService, useValue: requisitions },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  it('aggregates user counts and derives inactive from total − active', async () => {
    const { users } = await service.getDashboardStats(admin);
    expect(users).toMatchObject({
      total: 10,
      active: 7,
      inactive: 3,
      locked: 2,
    });
  });

  it('zero-fills every assignable role in byRole and overlays the grouped counts', async () => {
    const { users } = await service.getDashboardStats(admin);
    expect(Object.keys(users.byRole).sort()).toEqual(
      [...ASSIGNABLE_USER_ROLES].sort(),
    );
    expect(users.byRole[UserRole.EMPLOYEE]).toBe(6);
    expect(users.byRole[UserRole.SYSTEM_ADMIN]).toBe(1);
    expect(users.byRole[UserRole.SUPERVISOR]).toBe(0);
  });

  it('shows the retired Property Officer role only while an account still holds it', async () => {
    userQb.getRawMany.mockResolvedValueOnce([
      { role: UserRole.EMPLOYEE, count: '6' },
      { role: UserRole.PROPERTY_OFFICER, count: '1' },
    ]);

    const { users } = await service.getDashboardStats(admin);

    expect(users.byRole[UserRole.PROPERTY_OFFICER]).toBe(1);
  });

  it('reports pending-supervisor requisitions and the SLA-breached subset', async () => {
    const { requisitions } = await service.getDashboardStats(admin);
    expect(requisitions).toEqual({ pendingSupervisor: 9, slaBreached: 3 });
  });

  it('reports asset totals plus the low-stock count from the query builder', async () => {
    const { assets } = await service.getDashboardStats(admin);
    expect(assets).toEqual({ total: 2000, available: 1200, lowStock: 5 });
    expect(systemConfig.getDefaultReorderLevel).toHaveBeenCalled();
  });

  it('splits today’s audit volume into failed logins and all events', async () => {
    const { audit } = await service.getDashboardStats(admin);
    expect(audit).toEqual({ failedLoginsToday: 4, eventsToday: 42 });
  });

  // A superseded session's refresh attempt is audited as USER_LOGIN_FAILED with
  // reason refresh_token_reuse_detected (55 such rows in the dev database, from
  // tabs, reloads and a second sign-in), so the dashboard's "failed logins
  // today" counted ordinary session churn as if someone were guessing passwords.
  it('counts failed logins since the start of today, excluding superseded-session refresh rejections', async () => {
    await service.getDashboardStats(admin);

    expect(auditQb.where).toHaveBeenCalledWith('a.action = :action', {
      action: AuditAction.USER_LOGIN_FAILED,
    });
    expect(auditQb.andWhere).toHaveBeenCalledWith('a.timestamp >= :since', {
      since: expect.any(Date) as Date,
    });
    expect(auditQb.andWhere).toHaveBeenCalledWith(
      "COALESCE(a.metadata ->> 'reason', '') <> :reuse",
      { reuse: AUDIT_REASON_REFRESH_TOKEN_REUSE },
    );
  });

  // The administrator decides exactly what a custodian filed for themselves (nobody else may), and nothing else.
  // Counting "open requests" would show work that belongs to the custodians, so each queue is asked as the admin
  // and only what the server says the admin can act on is counted.
  describe('decisions waiting for the administrator', () => {
    it('counts only what the administrator may act on in each of the three queues', async () => {
      assetRequests.findQueue.mockResolvedValueOnce([
        { canAct: true },
        { canAct: false },
        { canAct: true },
      ]);
      repairs.list.mockResolvedValueOnce([{ canAct: false }, { canAct: true }]);
      requisitions.fulfilmentFallback.mockResolvedValueOnce({
        data: [{}, {}, {}, {}],
        total: 4,
      });

      const { decisions } = await service.getDashboardStats(admin);

      expect(decisions).toEqual({
        returnsIncidents: 2,
        repairs: 1,
        requisitions: 4,
      });
    });

    it('asks the open return / incident requests and open repairs as the signed-in administrator', async () => {
      await service.getDashboardStats(admin);

      expect(assetRequests.findQueue).toHaveBeenCalledWith(admin, 'open');
      expect(repairs.list).toHaveBeenCalledWith(admin, 'open');
      expect(requisitions.fulfilmentFallback).toHaveBeenCalledTimes(1);
    });

    it('reports zero everywhere when nothing is waiting', async () => {
      const { decisions } = await service.getDashboardStats(admin);

      expect(decisions).toEqual({
        returnsIncidents: 0,
        repairs: 0,
        requisitions: 0,
      });
    });
  });

  it('stamps generatedAt as an ISO-8601 timestamp', async () => {
    const { generatedAt } = await service.getDashboardStats(admin);
    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
  });
});
