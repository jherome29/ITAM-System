import { AuditController } from './audit.controller';
import type { AuditService } from './audit.service';

describe('AuditController', () => {
  const makeController = (svc: Partial<AuditService>) =>
    new AuditController(svc as AuditService);

  it('passes pagination, action, and date bounds through to the service', async () => {
    const findAll = jest.fn().mockResolvedValue({ data: [], total: 0 });
    const controller = makeController({ findAll });

    await controller.findAll(2, 25, 'user_login', '2026-09-01', '2026-09-30');

    expect(findAll).toHaveBeenCalledWith(
      2,
      25,
      'user_login',
      '2026-09-01',
      '2026-09-30',
    );
  });

  it('wraps the result in the standard response envelope', async () => {
    const page = { data: [{ id: 'a1' }], total: 1, page: 1, limit: 50 };
    const controller = makeController({
      findAll: jest.fn().mockResolvedValue(page),
    });

    const res = await controller.findAll();

    expect(res).toEqual({ message: 'Audit logs retrieved', data: page });
  });
});
