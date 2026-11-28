import { AuditController } from './audit.controller';
import type { AuditService } from './audit.service';
import { UserRole } from '../../../packages/shared/src/enums';

describe('AuditController', () => {
  // withNames adds who/what labels; echoing its input keeps these tests about
  // what the controller passes through and wraps.
  const named = () =>
    jest.fn((entries: unknown[]) =>
      Promise.resolve(entries.map((e) => ({ ...(e as object), named: true }))),
    );
  const makeController = (svc: Partial<AuditService>) =>
    new AuditController({ withNames: named(), ...svc } as AuditService);

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

  it('wraps the result in the standard response envelope, entries named', async () => {
    const page = { data: [{ id: 'a1' }], total: 1, page: 1, limit: 50 };
    const controller = makeController({
      findAll: jest.fn().mockResolvedValue(page),
    });

    const res = await controller.findAll();

    expect(res).toEqual({
      message: 'Audit logs retrieved',
      data: { ...page, data: [{ id: 'a1', named: true }] },
    });
  });

  it("names the entries of one account's activity", async () => {
    const page = { data: [{ id: 'a1' }], total: 1, page: 1, limit: 20 };
    const controller = makeController({
      findByUser: jest.fn().mockResolvedValue(page),
    });

    const res = await controller.findByUser(
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    );

    expect(res.data.data).toEqual([{ id: 'a1', named: true }]);
    expect(res.data.total).toBe(1);
  });

  it("asks for a record's history on behalf of the caller's role, and wraps it", async () => {
    const rows = [{ id: 'a1' }];
    const findRecordHistory = jest.fn().mockResolvedValue(rows);
    const controller = makeController({ findRecordHistory });

    const res = await controller.findByRecord('rec-1', {
      user: { role: UserRole.IT_PERSONNEL },
    });

    expect(findRecordHistory).toHaveBeenCalledWith(
      'rec-1',
      UserRole.IT_PERSONNEL,
    );
    expect(res).toEqual({
      message: 'Record audit history retrieved',
      data: [{ id: 'a1', named: true }],
    });
  });
});
