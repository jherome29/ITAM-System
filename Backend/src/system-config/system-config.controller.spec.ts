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
  };

  let svc: { getAll: jest.Mock; update: jest.Mock };
  let audit: { log: jest.Mock };
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
    controller = new SystemConfigController(svc as never, audit as never);
  });

  it('GET returns the service snapshot with a message', () => {
    const res = controller.getAll();
    expect(res.data).toBe(snapshot);
    expect(typeof res.message).toBe('string');
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

  it('PATCH with an empty body throws BadRequestException and does not audit', async () => {
    await expect(controller.update({}, req as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(svc.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
