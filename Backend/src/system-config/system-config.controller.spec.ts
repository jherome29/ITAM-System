import { BadRequestException } from '@nestjs/common';
import { SystemConfigController } from './system-config.controller';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';

// Pure mock — no DB, no Nest DI, no guards. The controller is exercised by
// constructing it directly with mocked SystemConfigService + AuditService.
describe('SystemConfigController', () => {
  const snapshot = {
    slaApprovalHours: 24,
    defaultReorderLevel: 10,
    usefulLifeYears: { PPE: 5, SEP: 3, IES: 1 },
    maxLoginAttempts: 5,
    meta: {},
  };

  let svc: { getAll: jest.Mock; update: jest.Mock };
  let audit: { log: jest.Mock };
  let userRepo: { find: jest.Mock };
  let controller: SystemConfigController;

  const req = {
    user: { id: 'admin-uuid', role: UserRole.SYSTEM_ADMIN },
    ip: '127.0.0.1',
  };

  beforeEach(() => {
    svc = {
      getAll: jest.fn(() => snapshot),
      update: jest.fn(() => Promise.resolve()),
    };
    audit = { log: jest.fn(() => Promise.resolve()) };
    userRepo = { find: jest.fn(() => Promise.resolve([])) };
    controller = new SystemConfigController(
      svc as never,
      audit as never,
      userRepo as never,
    );
  });

  it('GET returns the service snapshot with a message', async () => {
    const res = await controller.getAll();
    expect(res.data).toMatchObject(snapshot);
    expect(typeof res.message).toBe('string');
  });

  // "Last changed by 3fa85f64-5717-..." told the administrator nothing; the
  // provenance now names the person.
  describe('who changed a setting', () => {
    const withMeta = {
      ...snapshot,
      meta: {
        sla_approval_hours: {
          updatedAt: '2026-10-14T08:00:00.000Z',
          updatedBy: 'u-1',
        },
        default_reorder_level: { updatedAt: null, updatedBy: null },
        max_login_attempts: {
          updatedAt: '2026-10-10T08:00:00.000Z',
          updatedBy: 'u-gone',
        },
      },
    };

    beforeEach(() => {
      svc.getAll.mockReturnValue(withMeta);
      userRepo.find.mockResolvedValue([
        { id: 'u-1', firstName: 'Ana', lastName: 'Reyes' },
      ]);
    });

    it('GET adds the editor name to each setting that has one', async () => {
      const { data } = await controller.getAll();

      expect(data.meta.sla_approval_hours).toEqual({
        updatedAt: '2026-10-14T08:00:00.000Z',
        updatedBy: 'u-1',
        updatedByName: 'Ana Reyes',
      });
      expect(data.meta.default_reorder_level.updatedByName).toBeNull();
    });

    it('leaves the name empty for an account that no longer exists', async () => {
      const { data } = await controller.getAll();

      expect(data.meta.max_login_attempts.updatedByName).toBeNull();
    });

    it('looks the editors up once, by id', async () => {
      await controller.getAll();

      expect(userRepo.find).toHaveBeenCalledTimes(1);
    });

    it('PATCH answers with the same named provenance', async () => {
      const { data } = await controller.update(
        { slaApprovalHours: 30 },
        req as never,
      );

      expect(data.meta.sla_approval_hours.updatedByName).toBe('Ana Reyes');
    });
  });

  it('PATCH maps camelCase fields to snake_case keys and writes one audit entry', async () => {
    await controller.update(
      { slaApprovalHours: 30, usefulLifeYears: { PPE: 6, SEP: 4, IES: 2 } },
      req as never,
    );

    expect(svc.update).toHaveBeenCalledWith(
      'sla_approval_hours',
      30,
      'admin-uuid',
    );
    expect(svc.update).toHaveBeenCalledWith(
      'useful_life_years',
      { PPE: 6, SEP: 4, IES: 2 },
      'admin-uuid',
    );

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logArg = audit.log.mock.calls[0][0];
    expect(logArg.action).toBe(AuditAction.SYSTEM_CONFIG_UPDATED);
    expect(logArg.affectedRecordType).toBe('system_config');
    expect(logArg.metadata.changed).toEqual([
      'sla_approval_hours',
      'useful_life_years',
    ]);
  });

  it('PATCH maps the form identity fields to their keys', async () => {
    await controller.update(
      { entityName: 'CICC', fundCluster: '01 Regular Agency Fund' },
      req as never,
    );

    expect(svc.update).toHaveBeenCalledWith(
      'entity_name',
      'CICC',
      'admin-uuid',
    );
    expect(svc.update).toHaveBeenCalledWith(
      'fund_cluster',
      '01 Regular Agency Fund',
      'admin-uuid',
    );
  });

  it('PATCH with an empty body throws BadRequestException and does not audit', async () => {
    await expect(controller.update({}, req as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(svc.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
