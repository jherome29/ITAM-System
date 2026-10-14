import type { Response } from 'express';
import { AssetRequestsController } from './asset-requests.controller';
import type { AssetRequestsService } from './asset-requests.service';
import { UserRole } from '../../../packages/shared/src/enums';
import type { UserEntity } from '../users/entities/user.entity';

describe('AssetRequestsController', () => {
  const user = { id: 'u-1', role: UserRole.EMPLOYEE } as UserEntity;
  const req = { user, ip: '10.0.0.1' };
  const view = { id: 'ar-1', requestNumber: 'AR-2026-0001' };

  const service = {
    create: jest.fn().mockResolvedValue(view),
    findMine: jest.fn().mockResolvedValue([view]),
    findQueue: jest.fn().mockResolvedValue([view]),
    findOneForUser: jest.fn().mockResolvedValue(view),
    getAttachment: jest.fn().mockResolvedValue({
      mimeType: 'image/png',
      fileName: 'photo.png',
      content: Buffer.from('png'),
    }),
    getDocument: jest.fn().mockResolvedValue({
      form: { formType: 'RLSDDP', pdfContent: Buffer.from('%PDF-') },
      req: view,
    }),
    approve: jest.fn().mockResolvedValue(view),
    reject: jest.fn().mockResolvedValue(view),
    complete: jest.fn().mockResolvedValue(view),
    regenerateDocuments: jest.fn().mockResolvedValue(view),
    cancel: jest.fn().mockResolvedValue(view),
  };
  const controller = new AssetRequestsController(
    service as unknown as AssetRequestsService,
  );

  const mockRes = () => {
    const res = { set: jest.fn(), end: jest.fn() };
    return res as unknown as Response & typeof res;
  };

  beforeEach(() => jest.clearAllMocks());

  it('passes the body, uploaded files, caller and IP through on create', async () => {
    const dto = {
      assetId: 'a',
      type: 'return',
      preferredDate: '2026-10-20',
      details: 'x'.repeat(20),
    };
    const files = [
      { originalname: 'p.png', size: 3, buffer: Buffer.from('a') },
    ];
    await expect(controller.create(dto as never, files, req)).resolves.toEqual({
      message: 'AR-2026-0001 submitted',
      data: view,
    });
    expect(service.create).toHaveBeenCalledWith(dto, files, user, '10.0.0.1');
  });

  it('wraps list and detail reads in the response envelope', async () => {
    await expect(controller.findMine(req)).resolves.toEqual({
      message: 'Requests retrieved',
      data: [view],
    });
    await controller.findQueue(req, 'open');
    expect(service.findQueue).toHaveBeenCalledWith(user, 'open');
    await expect(controller.findOne('ar-1', req)).resolves.toMatchObject({
      data: view,
    });
  });

  it('streams an attachment with safe headers', async () => {
    const res = mockRes();
    await controller.attachment('ar-1', 'att-1', req, res);
    expect(service.getAttachment).toHaveBeenCalledWith('ar-1', 'att-1', user);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      }),
    );
    expect(res.end).toHaveBeenCalledWith(Buffer.from('png'));
  });

  it('streams a linked COA document as a PDF download', async () => {
    const res = mockRes();
    await controller.document('ar-1', 'f-1', req, res);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="RLSDDP-AR-2026-0001.pdf"',
      }),
    );
  });

  it('routes each custodian decision and the requester cancel to the service', async () => {
    await controller.approve('ar-1', { handoverDate: '2026-10-21' }, req);
    expect(service.approve).toHaveBeenCalledWith(
      'ar-1',
      { handoverDate: '2026-10-21' },
      user,
      '10.0.0.1',
    );
    await controller.reject('ar-1', { reason: 'No' }, req);
    expect(service.reject).toHaveBeenCalledWith(
      'ar-1',
      { reason: 'No' },
      user,
      '10.0.0.1',
    );
    await controller.complete('ar-1', { notes: 'ok' }, undefined, req);
    expect(service.complete).toHaveBeenCalledWith(
      'ar-1',
      { notes: 'ok' },
      user,
      '10.0.0.1',
      undefined,
    );
    await expect(controller.regenerateDocuments('ar-1', req)).resolves.toEqual({
      message: 'Documents generated',
      data: view,
    });
    await expect(controller.cancel('ar-1', req)).resolves.toEqual({
      message: 'AR-2026-0001 cancelled',
      data: view,
    });
  });
});
