import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';
import type { Response } from 'express';
import { UserRole } from '../../../packages/shared/src/enums';
import type { UserEntity } from '../users/entities/user.entity';

// GenerateReportDto and AuthReq are module-private, so the bodies below are
// plain object literals — they structurally satisfy the method signature.
const makeRes = () => {
  const res = {
    set: jest.fn(),
    end: jest.fn(),
  };
  return res as unknown as Response & typeof res;
};

const makeReq = () => ({
  user: { id: 'user-1', role: UserRole.IT_PERSONNEL } as UserEntity,
  ip: '10.0.0.1',
});

describe('ReportsController — generate', () => {
  const makeService = () =>
    ({
      generate: jest.fn().mockResolvedValue({ buffer: Buffer.from('report') }),
    }) as unknown as ReportsService & { generate: jest.Mock };

  // Regression: the controller used to normalise with dto.format.toUpperCase(),
  // which turns 'excel' into 'EXCEL'. generated_reports carries
  // CHECK (format IN ('PDF','Excel')), so every Excel export built its workbook
  // and then died on the INSERT with a 500. The frontend only ever sends the
  // lowercase form (Frontend/lib/api/reports.ts), so this was the normal path.
  it.each([
    ['excel', 'Excel'],
    ['Excel', 'Excel'],
    ['EXCEL', 'Excel'],
    ['pdf', 'PDF'],
    ['PDF', 'PDF'],
  ])('normalises format %s to the DB-accepted %s', async (wire, expected) => {
    const service = makeService();
    const controller = new ReportsController(service);

    await controller.generate(
      { reportType: 'asset_master_list', format: wire },
      makeReq(),
      makeRes(),
    );

    expect(service.generate).toHaveBeenCalledWith(
      'asset_master_list',
      expected,
      'user-1',
      UserRole.IT_PERSONNEL,
      '10.0.0.1',
    );
  });

  it('streams an xlsx content-type and filename for an Excel export', async () => {
    const service = makeService();
    const res = makeRes();

    await new ReportsController(service).generate(
      { reportType: 'asset_master_list', format: 'excel' },
      makeReq(),
      res,
    );

    const headers = res.set.mock.calls[0][0] as Record<string, string>;
    expect(headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(headers['Content-Disposition']).toMatch(/\.xlsx"$/);
    expect(res.end).toHaveBeenCalledWith(Buffer.from('report'));
  });

  it('streams a pdf content-type and filename for a PDF export', async () => {
    const service = makeService();
    const res = makeRes();

    await new ReportsController(service).generate(
      { reportType: 'audit_trail', format: 'pdf' },
      makeReq(),
      res,
    );

    const headers = res.set.mock.calls[0][0] as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Content-Disposition']).toMatch(/\.pdf"$/);
  });
});
