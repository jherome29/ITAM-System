import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AssetRequestsService,
  blockingRequest,
  completionTargetStatus,
  requiredDocuments,
  clearsAccountability,
} from './asset-requests.service';
import { AssetRequestEntity } from './entities/asset-request.entity';
import { AssetRequestAttachmentEntity } from './entities/asset-request-attachment.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AssetsService } from '../assets/assets.service';
import { ReportsService } from '../reports/reports.service';
import { GeneratedFormEntity } from '../reports/entities/generated-form.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { checkAttachments, sanitizeFileName } from './attachment-files';
import {
  AssetClass,
  AssetRequestStatus,
  AssetRequestType,
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  OfficialFormType,
  UserRole,
} from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

const user = (id: string, role: UserRole, extra: Partial<UserEntity> = {}) =>
  ({
    id,
    role,
    firstName: 'Test',
    lastName: id,
    employeeId: `EMP-${id}`,
    officeOrSection: 'Ops',
    ...extra,
  }) as UserEntity;

const EMP = user('emp-1', UserRole.EMPLOYEE);
const OTHER_EMP = user('emp-2', UserRole.EMPLOYEE);
const IT = user('it-1', UserRole.IT_PERSONNEL);
const PC = user('pc-1', UserRole.PROPERTY_CUSTODIAN);

const ictAsset = (extra: Partial<AssetEntity> = {}) =>
  ({
    id: 'asset-1',
    itemDescription: 'Dell Latitude',
    assetType: AssetType.ICT,
    assetClass: AssetClass.PPE,
    status: AssetStatus.ISSUED,
    custodianId: EMP.id,
    ...extra,
  }) as AssetEntity;

const makeReq = (extra: Partial<AssetRequestEntity> = {}) =>
  ({
    id: 'ar-1',
    requestNumber: 'AR-2026-0001',
    assetId: 'asset-1',
    requestedById: EMP.id,
    type: AssetRequestType.RETURN,
    status: AssetRequestStatus.SUBMITTED,
    preferredDate: '2026-10-20',
    details: 'Returning after project end',
    handoverDate: null,
    decidedById: null,
    completedById: null,
    resultingStatus: null,
    asset: ictAsset(),
    attachments: [],
    ...extra,
  }) as unknown as AssetRequestEntity;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('asset request rules', () => {
  const open = (type: AssetRequestType) => ({ type });

  it('allows only one open return/repair/damage request per asset', () => {
    expect(
      blockingRequest(AssetRequestType.REPAIR, [open(AssetRequestType.RETURN)]),
    ).toBeDefined();
    expect(blockingRequest(AssetRequestType.RETURN, [])).toBeUndefined();
  });

  it('still lets a loss/theft be reported while a return is open', () => {
    expect(
      blockingRequest(AssetRequestType.THEFT, [open(AssetRequestType.RETURN)]),
    ).toBeUndefined();
  });

  it('blocks a second incident, and anything else, while one is open', () => {
    expect(
      blockingRequest(AssetRequestType.LOSS, [open(AssetRequestType.THEFT)]),
    ).toBeDefined();
    expect(
      blockingRequest(AssetRequestType.RETURN, [open(AssetRequestType.LOSS)]),
    ).toBeDefined();
  });

  it('maps each request type to the asset status completion moves it to', () => {
    expect(completionTargetStatus(AssetRequestType.RETURN)).toBe(
      AssetStatus.RETURNED,
    );
    expect(completionTargetStatus(AssetRequestType.REPAIR)).toBe(
      AssetStatus.UNDER_REPAIR,
    );
    expect(completionTargetStatus(AssetRequestType.DAMAGE, 'disposal')).toBe(
      AssetStatus.FLAGGED_FOR_DISPOSAL,
    );
    expect(completionTargetStatus(AssetRequestType.THEFT)).toBe(
      AssetStatus.FLAGGED_FOR_DISPOSAL,
    );
    expect(() => completionTargetStatus(AssetRequestType.DAMAGE)).toThrow(
      BadRequestException,
    );
  });

  describe('requiredDocuments (CLAUDE.md §7.2 trigger events)', () => {
    const done = (
      type: AssetRequestType,
      resultingStatus: string | null = null,
    ) =>
      ({
        type,
        status: AssetRequestStatus.COMPLETED,
        resultingStatus,
      }) as AssetRequestEntity;
    const forms = (type: AssetRequestType, cls: AssetClass, rs?: string) =>
      requiredDocuments(done(type, rs ?? null), cls);

    it('return → receipt matching the asset class', () => {
      expect(forms(AssetRequestType.RETURN, AssetClass.PPE)).toEqual([
        { formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY },
      ]);
      expect(forms(AssetRequestType.RETURN, AssetClass.SEP)).toEqual([
        { formType: OfficialFormType.RECEIPT_RETURNED_SEP },
      ]);
    });

    it('repair → no COA form', () => {
      expect(forms(AssetRequestType.REPAIR, AssetClass.PPE)).toEqual([]);
    });

    it('loss / theft → RLSDDP only, with the right loss type', () => {
      expect(forms(AssetRequestType.LOSS, AssetClass.PPE)).toEqual([
        { formType: OfficialFormType.RLSDDP, lossType: 'Lost' },
      ]);
      expect(forms(AssetRequestType.THEFT, AssetClass.SEP)).toEqual([
        { formType: OfficialFormType.RLSDDP, lossType: 'Stolen' },
      ]);
    });

    it('damage → RLSDDP; plus receipt + IIRUP when surrendered for disposal', () => {
      expect(
        forms(
          AssetRequestType.DAMAGE,
          AssetClass.PPE,
          AssetStatus.UNDER_REPAIR,
        ),
      ).toEqual([{ formType: OfficialFormType.RLSDDP, lossType: 'Damaged' }]);
      expect(
        forms(
          AssetRequestType.DAMAGE,
          AssetClass.PPE,
          AssetStatus.FLAGGED_FOR_DISPOSAL,
        ).map((d) => d.formType),
      ).toEqual([
        OfficialFormType.RECEIPT_RETURNED_PROPERTY,
        OfficialFormType.RLSDDP,
        OfficialFormType.IIRUP,
      ]);
    });

    it('nothing before completion', () => {
      expect(
        requiredDocuments(
          {
            ...done(AssetRequestType.RETURN),
            status: AssetRequestStatus.APPROVED,
          },
          AssetClass.PPE,
        ),
      ).toEqual([]);
    });
  });

  it('accountability ends only when the item is surrendered for good', () => {
    expect(
      clearsAccountability(AssetRequestType.RETURN, AssetStatus.RETURNED),
    ).toBe(true);
    expect(
      clearsAccountability(
        AssetRequestType.DAMAGE,
        AssetStatus.FLAGGED_FOR_DISPOSAL,
      ),
    ).toBe(true);
    expect(
      clearsAccountability(AssetRequestType.DAMAGE, AssetStatus.UNDER_REPAIR),
    ).toBe(false);
    expect(
      clearsAccountability(
        AssetRequestType.THEFT,
        AssetStatus.FLAGGED_FOR_DISPOSAL,
      ),
    ).toBe(false);
    expect(
      clearsAccountability(AssetRequestType.REPAIR, AssetStatus.UNDER_REPAIR),
    ).toBe(false);
  });
});

describe('attachment checks', () => {
  const file = (buffer: Buffer, originalname = 'photo.png') => ({
    buffer,
    originalname,
    size: buffer.length,
  });

  it('accepts a real PNG and detects its type from content', () => {
    expect(checkAttachments([file(PNG)])[0].mimeType).toBe('image/png');
  });

  it('rejects a renamed non-image file', () => {
    expect(() =>
      checkAttachments([file(Buffer.from('MZ\x90\x00'), 'evil.jpg')]),
    ).toThrow(BadRequestException);
  });

  it('rejects more than 3 files or a file over 5 MB', () => {
    expect(() => checkAttachments([1, 2, 3, 4].map(() => file(PNG)))).toThrow(
      BadRequestException,
    );
    expect(() =>
      checkAttachments([{ ...file(PNG), size: 5 * 1024 * 1024 + 1 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects tampered shapes instead of trusting the type (CodeQL)', () => {
    expect(() => checkAttachments('attachments')).toThrow(BadRequestException);
    expect(() => checkAttachments({ length: 1 })).toThrow(BadRequestException);
    expect(() =>
      checkAttachments([
        { originalname: 'x.png', size: 4, buffer: 'not-a-buffer' },
      ]),
    ).toThrow(BadRequestException);
    expect(checkAttachments(undefined)).toEqual([]);
    expect(checkAttachments(null)).toEqual([]);
  });

  it('strips paths and unsafe characters from file names', () => {
    expect(sanitizeFileName('..\\..\\etc/pa"ss;wd.png')).toBe('pa_ss_wd.png');
    expect(sanitizeFileName('')).toBe('attachment');
  });
});

describe('AssetRequestsService', () => {
  let service: AssetRequestsService;
  let current: AssetRequestEntity;

  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve(current)),
    getMany: jest.fn(() => Promise.resolve([current])),
  };

  // Transaction-scoped repositories used by create().
  const txAssetRepo = { findOne: jest.fn() };
  const txReqRepo = {
    find: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve({ id: 'ar-new', ...x })),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(4),
    })),
  };
  const txAttachmentRepo = {
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve(x)),
  };
  const em = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === AssetEntity) return txAssetRepo;
      if (entity === AssetRequestEntity) return txReqRepo;
      return txAttachmentRepo;
    }),
    query: jest.fn(),
  };

  const mockAssetUpdate = jest.fn();
  const mockRepo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn(),
    manager: {
      transaction: jest.fn((cb: (m: typeof em) => unknown) => cb(em)),
      getRepository: jest.fn(() => ({ update: mockAssetUpdate })),
    },
  };
  const mockAssets = { updateLifecycle: jest.fn() };
  const mockFormRepo = { find: jest.fn() };
  const mockReports = { generateFormRecord: jest.fn() };
  const mockAttachmentRepo = {
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve(x)),
  };
  const mockAudit = { log: jest.fn() };
  const mockNotify = { notify: jest.fn() };
  const mockUsers = {
    findByRole: jest.fn(),
    findOne: jest.fn((id: string) =>
      Promise.resolve([EMP, IT, PC].find((u) => u.id === id)),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    current = makeReq();
    mockUsers.findByRole.mockImplementation((role: UserRole) =>
      Promise.resolve(
        role === UserRole.IT_PERSONNEL
          ? [IT]
          : role === UserRole.PROPERTY_CUSTODIAN
            ? [PC]
            : [],
      ),
    );
    const module = await Test.createTestingModule({
      providers: [
        AssetRequestsService,
        { provide: getRepositoryToken(AssetRequestEntity), useValue: mockRepo },
        {
          provide: getRepositoryToken(AssetRequestAttachmentEntity),
          useValue: mockAttachmentRepo,
        },
        { provide: AssetsService, useValue: mockAssets },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotify },
        { provide: UsersService, useValue: mockUsers },
        {
          provide: getRepositoryToken(GeneratedFormEntity),
          useValue: mockFormRepo,
        },
        { provide: ReportsService, useValue: mockReports },
      ],
    }).compile();
    service = module.get(AssetRequestsService);
    mockFormRepo.find.mockResolvedValue([]);
    mockReports.generateFormRecord.mockResolvedValue({
      form: {},
      buffer: Buffer.alloc(0),
    });
  });

  describe('create()', () => {
    const dto = {
      assetId: 'asset-1',
      type: AssetRequestType.RETURN,
      preferredDate: '2026-10-20',
      details: 'Project finished, returning the laptop',
    };

    beforeEach(() => {
      txAssetRepo.findOne.mockResolvedValue(ictAsset());
      txReqRepo.find.mockResolvedValue([]);
    });

    it('rejects a request on an asset not issued to the caller', async () => {
      await expect(service.create(dto, [], OTHER_EMP, 'ip')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a request on an asset that is not issued', async () => {
      txAssetRepo.findOne.mockResolvedValue(
        ictAsset({ status: AssetStatus.UNDER_REPAIR }),
      );
      await expect(service.create(dto, [], EMP, 'ip')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a second open request on the same asset (409)', async () => {
      txReqRepo.find.mockResolvedValue([
        { requestNumber: 'AR-2026-0002', type: AssetRequestType.REPAIR },
      ]);
      await expect(service.create(dto, [], EMP, 'ip')).rejects.toThrow(
        ConflictException,
      );
    });

    it('locks the asset, numbers the request, stores files, notifies IT and audits', async () => {
      await service.create(
        dto,
        [{ buffer: PNG, originalname: 'cracked.png', size: PNG.length }],
        EMP,
        'ip',
      );
      expect(txAssetRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(txReqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestNumber: expect.stringMatching(/^AR-\d{4}-0005$/),
        }),
      );
      expect(txAttachmentRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ mimeType: 'image/png', requestId: 'ar-new' }),
      ]);
      expect(mockNotify.notify).toHaveBeenCalledTimes(1);
      expect(mockNotify.notify).toHaveBeenCalledWith(
        IT.id,
        NotificationAlertType.ASSET_REQUEST,
        expect.stringContaining('Return'),
        expect.any(String),
        'ar-new',
        'asset_request',
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSET_REQUEST_SUBMITTED,
        }),
      );
    });

    it('rejects a disguised file before touching the database', async () => {
      await expect(
        service.create(
          dto,
          [
            {
              buffer: Buffer.from('not an image'),
              originalname: 'x.jpg',
              size: 12,
            },
          ],
          EMP,
          'ip',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('queues, downloads and document retry', () => {
    const fileQb = (result: unknown) => ({
      addSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    });

    it('scopes the custodian queue by asset type and the "open" filter', async () => {
      await service.findQueue(PC, 'open');
      expect(qb.where).toHaveBeenCalledWith('asset.assetType IN (:...scope)', {
        scope: [AssetType.FIXED, AssetType.SUPPLIES],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('r.status IN (:...open)', {
        open: [AssetRequestStatus.SUBMITTED, AssetRequestStatus.APPROVED],
      });
    });

    it('lets Admin/Management see every request, filtered by one status', async () => {
      const admin = user('ad-1', UserRole.SYSTEM_ADMIN);
      await service.findQueue(admin, 'completed');
      expect(qb.where).not.toHaveBeenCalledWith(
        'asset.assetType IN (:...scope)',
        expect.anything(),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: 'completed',
      });
    });

    it("lists the requester's own requests with resolved names", async () => {
      current = makeReq({
        status: AssetRequestStatus.APPROVED,
        decidedById: IT.id,
      });
      const [row] = await service.findMine(EMP.id);
      expect(qb.where).toHaveBeenCalledWith('r.requestedById = :userId', {
        userId: EMP.id,
      });
      expect(row.decidedBy?.name).toBe('Test it-1');
    });

    it('serves an attachment only to someone who can read the request', async () => {
      const file = { id: 'att-1', content: PNG };
      (mockAttachmentRepo as Record<string, unknown>).createQueryBuilder =
        jest.fn(() => fileQb(file));
      await expect(service.getAttachment('ar-1', 'att-1', EMP)).resolves.toBe(
        file,
      );
      await expect(
        service.getAttachment('ar-1', 'att-1', OTHER_EMP),
      ).rejects.toThrow(ForbiddenException);
      (mockAttachmentRepo as Record<string, unknown>).createQueryBuilder =
        jest.fn(() => fileQb(null));
      await expect(service.getAttachment('ar-1', 'att-x', EMP)).rejects.toThrow(
        'Attachment not found',
      );
    });

    it('serves a linked document to the requester, never to others', async () => {
      const form = {
        id: 'f-1',
        formType: 'RLSDDP',
        pdfContent: Buffer.from('%PDF-'),
      };
      (mockFormRepo as Record<string, unknown>).createQueryBuilder = jest.fn(
        () => fileQb(form),
      );
      await expect(
        service.getDocument('ar-1', 'f-1', EMP),
      ).resolves.toMatchObject({
        form,
      });
      await expect(
        service.getDocument('ar-1', 'f-1', OTHER_EMP),
      ).rejects.toThrow(ForbiddenException);
      (mockFormRepo as Record<string, unknown>).createQueryBuilder = jest.fn(
        () => fileQb(null),
      );
      await expect(service.getDocument('ar-1', 'f-x', EMP)).rejects.toThrow(
        'Document not found',
      );
    });

    it('regenerates only missing documents, and only once completed', async () => {
      await expect(
        service.regenerateDocuments('ar-1', IT, 'ip'),
      ).rejects.toThrow(BadRequestException);
      current = makeReq({
        status: AssetRequestStatus.COMPLETED,
        type: AssetRequestType.DAMAGE,
        resultingStatus: AssetStatus.FLAGGED_FOR_DISPOSAL,
      });
      mockFormRepo.find.mockResolvedValue([
        { id: 'f-1', formType: OfficialFormType.RLSDDP },
      ]);
      await service.regenerateDocuments('ar-1', IT, 'ip');
      expect(
        mockReports.generateFormRecord.mock.calls.map(
          (c: [{ formType: string }]) => c[0].formType,
        ),
      ).toEqual([
        OfficialFormType.RECEIPT_RETURNED_PROPERTY,
        OfficialFormType.IIRUP,
      ]);
    });
  });

  describe('reads', () => {
    it('hides a request from an unrelated employee', async () => {
      await expect(service.findOneForUser('ar-1', OTHER_EMP)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('hides an ICT request from the Property Custodian', async () => {
      await expect(service.findOneForUser('ar-1', PC)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('shows it to the requester and the IT custodian', async () => {
      await expect(service.findOneForUser('ar-1', EMP)).resolves.toBeDefined();
      await expect(service.findOneForUser('ar-1', IT)).resolves.toBeDefined();
    });
  });

  describe('approve()', () => {
    it('only lets the custodian for that asset type act', async () => {
      await expect(service.approve('ar-1', {}, PC, 'ip')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('never lets a custodian approve their own request', async () => {
      current = makeReq({ requestedById: IT.id });
      await expect(service.approve('ar-1', {}, IT, 'ip')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('approves, records the hand-over date and tells the requester', async () => {
      await service.approve('ar-1', { handoverDate: '2026-10-15' }, IT, 'ip');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'ar-1',
        expect.objectContaining({
          status: AssetRequestStatus.APPROVED,
          handoverDate: '2026-10-15',
          decidedById: IT.id,
        }),
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.ASSET_REQUEST_UPDATE,
        'Return Request Approved',
        expect.stringContaining('IT Asset Custodian'),
        'ar-1',
        'asset_request',
      );
    });

    it('refuses to approve twice', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await expect(service.approve('ar-1', {}, IT, 'ip')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('complete()', () => {
    it('requires approval first', async () => {
      await expect(service.complete('ar-1', {}, IT, 'ip')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAssets.updateLifecycle).not.toHaveBeenCalled();
    });

    it('marks a return received: asset → returned, requester told', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await service.complete('ar-1', {}, IT, 'ip');
      expect(mockAssets.updateLifecycle).toHaveBeenCalledWith(
        'asset-1',
        expect.objectContaining({ status: AssetStatus.RETURNED }),
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
        [AssetType.ICT],
      );
      expect(mockRepo.update).toHaveBeenCalledWith(
        'ar-1',
        expect.objectContaining({
          status: AssetRequestStatus.COMPLETED,
          resultingStatus: AssetStatus.RETURNED,
        }),
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.ASSET_REQUEST_UPDATE,
        'Return Request Completed',
        expect.stringContaining('no longer assigned to you'),
        'ar-1',
        'asset_request',
      );
    });

    const generatedTypes = () =>
      mockReports.generateFormRecord.mock.calls.map(
        (c: [{ formType: string; lossType?: string }]) =>
          `${c[0].formType}${c[0].lossType ? `:${c[0].lossType}` : ''}`,
      );

    it('return: generates the receipt linked to the request, returnee = requester', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await service.complete('ar-1', {}, IT, 'ip');
      expect(mockReports.generateFormRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
          assetRequestId: 'ar-1',
          returneeId: EMP.id,
        }),
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.ASSET_REQUEST_UPDATE,
        'Return Request Completed',
        expect.stringContaining('Receipt of Returned Property'),
        'ar-1',
        'asset_request',
      );
    });

    it('theft: RLSDDP (Stolen), asset flagged, holder stays accountable', async () => {
      current = makeReq({
        status: AssetRequestStatus.APPROVED,
        type: AssetRequestType.THEFT,
      });
      await service.complete('ar-1', {}, IT, 'ip');
      expect(generatedTypes()).toEqual(['RLSDDP:Stolen']);
      expect(mockAssets.updateLifecycle).toHaveBeenCalledWith(
        'asset-1',
        expect.objectContaining({ status: AssetStatus.FLAGGED_FOR_DISPOSAL }),
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
        [AssetType.ICT],
      );
      expect(mockAssetUpdate).not.toHaveBeenCalled();
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.ASSET_REQUEST_UPDATE,
        'Theft Report Completed',
        expect.stringContaining('until COA grants relief'),
        'ar-1',
        'asset_request',
      );
    });

    it('damage → disposal: receipt + RLSDDP (Damaged) + IIRUP, accountability cleared', async () => {
      current = makeReq({
        status: AssetRequestStatus.APPROVED,
        type: AssetRequestType.DAMAGE,
      });
      await service.complete(
        'ar-1',
        { outcome: 'disposal', notes: 'Cracked board' },
        IT,
        'ip',
      );
      expect(generatedTypes()).toEqual([
        'RECEIPT_RETURNED_PROPERTY',
        'RLSDDP:Damaged',
        'IIRUP',
      ]);
      expect(mockAssetUpdate).toHaveBeenCalledWith('asset-1', {
        custodianId: null,
      });
    });

    it('damage → repair: RLSDDP only, holder keeps the item', async () => {
      current = makeReq({
        status: AssetRequestStatus.APPROVED,
        type: AssetRequestType.DAMAGE,
      });
      await service.complete('ar-1', { outcome: 'repair' }, IT, 'ip');
      expect(generatedTypes()).toEqual(['RLSDDP:Damaged']);
      expect(mockAssetUpdate).not.toHaveBeenCalled();
    });

    it('repair: no COA document', async () => {
      current = makeReq({
        status: AssetRequestStatus.APPROVED,
        type: AssetRequestType.REPAIR,
      });
      await service.complete('ar-1', {}, IT, 'ip');
      expect(mockReports.generateFormRecord).not.toHaveBeenCalled();
    });

    it('a failed document does not undo the completion; it is reported as missing', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      mockReports.generateFormRecord.mockRejectedValueOnce(
        new Error('pdf boom'),
      );
      const view = await service.complete('ar-1', {}, IT, 'ip');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'ar-1',
        expect.objectContaining({ status: AssetRequestStatus.COMPLETED }),
      );
      expect(view.missingDocuments).toEqual([
        OfficialFormType.RECEIPT_RETURNED_PROPERTY,
      ]);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSET_REQUEST_COMPLETED,
          metadata: expect.objectContaining({
            missingDocuments: [OfficialFormType.RECEIPT_RETURNED_PROPERTY],
          }),
        }),
      );
    });

    it('stores condition-on-receipt photos as receipt-stage attachments', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await service.complete('ar-1', { notes: 'Scuffed lid' }, IT, 'ip', [
        { buffer: PNG, originalname: 'on-receipt.png', size: PNG.length },
      ]);
      expect(mockAttachmentRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          stage: 'receipt',
          uploadedById: IT.id,
          requestId: 'ar-1',
          mimeType: 'image/png',
        }),
      ]);
    });

    it('rejects a bad receipt photo before changing the asset', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await expect(
        service.complete('ar-1', {}, IT, 'ip', [
          { buffer: Buffer.from('nope'), originalname: 'x.png', size: 4 },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(mockAssets.updateLifecycle).not.toHaveBeenCalled();
    });

    it('leaves the request approved if the lifecycle change is refused', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      mockAssets.updateLifecycle.mockRejectedValueOnce(
        new BadRequestException('Invalid lifecycle transition'),
      );
      await expect(service.complete('ar-1', {}, IT, 'ip')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('reject() / cancel()', () => {
    it('rejects an open request and tells the requester why', async () => {
      await service.reject('ar-1', { reason: 'Asset still needed' }, IT, 'ip');
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.ASSET_REQUEST_UPDATE,
        'Return Request Rejected',
        expect.stringContaining('Asset still needed'),
        'ar-1',
        'asset_request',
      );
    });

    it('cannot reject once approved — only mark received is left', async () => {
      current = makeReq({ status: AssetRequestStatus.APPROVED });
      await expect(
        service.reject('ar-1', { reason: 'Changed my mind' }, IT, 'ip'),
      ).rejects.toThrow('already approved');
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('only the requester can cancel', async () => {
      await expect(service.cancel('ar-1', OTHER_EMP, 'ip')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cancelling tells the custodians', async () => {
      await service.cancel('ar-1', EMP, 'ip');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'ar-1',
        expect.objectContaining({ status: AssetRequestStatus.CANCELLED }),
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        IT.id,
        NotificationAlertType.ASSET_REQUEST,
        'Return Request Cancelled',
        expect.any(String),
        'ar-1',
        'asset_request',
      );
    });

    it('cannot cancel a completed request', async () => {
      current = makeReq({ status: AssetRequestStatus.COMPLETED });
      await expect(service.cancel('ar-1', EMP, 'ip')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
