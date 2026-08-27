import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { RequisitionEntity } from './entities/requisition.entity';
import { RequisitionItemEntity } from './entities/requisition-item.entity';
import { RequisitionApprovalEntity } from './entities/requisition-approval.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  RequisitionStatus,
  RequisitionType,
  UserRole,
  AuditAction,
  NotificationAlertType,
  AssetType,
  AssetClass,
} from '../../../packages/shared/src/enums';
import { SLA_APPROVAL_HOURS } from '../../../packages/shared/src/constants';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeReq = (
  overrides: Partial<RequisitionEntity> = {},
): RequisitionEntity =>
  ({
    id: 'req-uuid-1',
    requestNumber: 'REQ-2026-0001',
    requestedById: 'emp-uuid-1',
    requisitionType: RequisitionType.NEW,
    status: RequisitionStatus.PENDING_SUPERVISOR,
    justification: 'Need a laptop for fieldwork',
    requiredDate: new Date('2026-07-01'),
    supervisorId: 'sup-uuid-1',
    supervisorDecision: null,
    supervisorComments: '',
    supervisorDecidedAt: null,
    itPersonnelId: null,
    fulfilledAt: null,
    fulfillmentNotes: '',
    submittedAt: new Date(),
    slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1_000),
    slaBreachNotifiedAt: null,
    pendingNudgeNotifiedAt: null,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as RequisitionEntity;

describe('RequisitionsService', () => {
  let service: RequisitionsService;

  // ── Mock repositories ─────────────────────────────────────────────────────
  const mockItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockAssetRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAssetsService = {
    notifyLowStockIfBelowThreshold: jest.fn().mockResolvedValue(false),
  };

  const mockReqRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    // fulfill() wraps its item-linking + stock decrement + status flip in
    // reqRepo.manager.transaction(); the runner is attached just below (an
    // in-initializer self-reference would trip TS7022).
    manager: { transaction: jest.fn() },
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    }),
  };

  // Run the transaction callback inline against a real per-entity getRepository
  // switch so decrement/link assertions land on the right repo (the AssetEntity
  // repo must NOT be the same object as the RequisitionItemEntity repo).
  mockReqRepo.manager.transaction.mockImplementation(
    (cb: (em: { getRepository: (e: unknown) => unknown }) => unknown) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === AssetEntity) return mockAssetRepo;
          if (entity === RequisitionItemEntity) return mockItemRepo;
          if (entity === RequisitionEntity) return mockReqRepo;
          throw new Error(
            'transaction mock: unexpected getRepository() entity',
          );
        },
      }),
  );

  const mockApprovalRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotifService = {
    notify: jest.fn().mockResolvedValue(undefined),
  };

  const mockUsersService = {
    findByRole: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    findSupervisorForSection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsService,
        {
          provide: getRepositoryToken(RequisitionEntity),
          useValue: mockReqRepo,
        },
        {
          provide: getRepositoryToken(RequisitionItemEntity),
          useValue: mockItemRepo,
        },
        {
          provide: getRepositoryToken(RequisitionApprovalEntity),
          useValue: mockApprovalRepo,
        },
        {
          provide: getRepositoryToken(AssetEntity),
          useValue: mockAssetRepo,
        },
        { provide: AssetsService, useValue: mockAssetsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotifService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<RequisitionsService>(RequisitionsService);
    jest.clearAllMocks();

    // Reset the chainable QB mock for each test
    mockReqRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    });
  });

  // ── Section 12.4 — Submit → Approve → Fulfill flow ──────────────────────

  describe('create() — submit new requisition', () => {
    const requester = {
      id: 'emp-uuid-1',
      officeOrSection: 'Digital Forensics',
      division: 'Operations',
    };
    const resolvedSupervisor = { id: 'sup-uuid-1' };

    beforeEach(() => {
      mockUsersService.findOne.mockResolvedValue(requester);
      mockUsersService.findSupervisorForSection.mockResolvedValue(
        resolvedSupervisor,
      );
    });

    it('sets status to PENDING_SUPERVISOR and audits submission', async () => {
      mockReqRepo.count.mockResolvedValue(0);

      const saved = makeReq({ status: RequisitionStatus.PENDING_SUPERVISOR });
      mockReqRepo.create.mockReturnValue(saved);
      mockReqRepo.save.mockResolvedValue(saved);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue([{}]);

      const dto = {
        requisitionType: RequisitionType.NEW,
        justification: 'Need a laptop',
        requiredDate: '2026-07-01',
        items: [
          {
            assetType: 'ICT',
            assetClass: 'PPE',
            itemDescription: 'Laptop',
            quantity: 1,
          },
        ],
      } as any;

      const result = await service.create(
        dto,
        'emp-uuid-1',
        UserRole.EMPLOYEE,
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.PENDING_SUPERVISOR);

      // Audit log for submission
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REQUISITION_SUBMITTED }),
      );

      // Supervisor notification sent
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        'sup-uuid-1',
        NotificationAlertType.PENDING_APPROVAL,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'requisition',
      );
    });

    it('generates a sequential request number REQ-YYYY-NNNN', async () => {
      mockReqRepo.count.mockResolvedValue(41); // 42nd request
      const saved = makeReq({ requestNumber: 'REQ-2026-0042' });
      mockReqRepo.create.mockReturnValue(saved);
      mockReqRepo.save.mockResolvedValue(saved);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue([]);

      const result = await service.create(
        {
          requisitionType: RequisitionType.NEW,
          justification: 'test',
          requiredDate: '2026-07-01',
          items: [{}],
        } as any,
        'emp-1',
        UserRole.EMPLOYEE,
        '127.0.0.1',
      );

      expect(result.requestNumber).toMatch(/^REQ-\d{4}-\d{4}$/);
    });

    // ── Server-side supervisor resolution (Fix 1) ────────────────────────────
    it('resolves supervisorId server-side from the requester officeOrSection/division', async () => {
      mockReqRepo.count.mockResolvedValue(0);
      const saved = makeReq({ status: RequisitionStatus.PENDING_SUPERVISOR });
      mockReqRepo.create.mockReturnValue(saved);
      mockReqRepo.save.mockResolvedValue(saved);
      mockItemRepo.create.mockReturnValue({});
      mockItemRepo.save.mockResolvedValue([]);

      await service.create(
        {
          requisitionType: RequisitionType.NEW,
          justification: 'Need a laptop',
          requiredDate: '2026-07-01',
          items: [{}],
        } as any,
        'emp-uuid-1',
        UserRole.EMPLOYEE,
        '127.0.0.1',
      );

      expect(mockUsersService.findOne).toHaveBeenCalledWith('emp-uuid-1');
      expect(mockUsersService.findSupervisorForSection).toHaveBeenCalledWith(
        requester.officeOrSection,
        requester.division,
      );
      expect(mockReqRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ supervisorId: resolvedSupervisor.id }),
      );
    });

    it('throws BadRequestException when no supervisor is configured for the section', async () => {
      mockUsersService.findSupervisorForSection.mockResolvedValue(null);

      await expect(
        service.create(
          {
            requisitionType: RequisitionType.NEW,
            justification: 'Need a laptop',
            requiredDate: '2026-07-01',
            items: [{}],
          } as any,
          'emp-uuid-1',
          UserRole.EMPLOYEE,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockReqRepo.create).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('approve() — supervisor approval flow', () => {
    it('transitions status to PENDING_FULFILLMENT and notifies IT + requester', async () => {
      const req = makeReq({ status: RequisitionStatus.PENDING_SUPERVISOR });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockApprovalRepo.create.mockReturnValue({});
      mockApprovalRepo.save.mockResolvedValue({});
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.PENDING_FULFILLMENT,
      });

      const itUser = { id: 'it-user-1' };
      mockUsersService.findByRole.mockResolvedValue([itUser]);

      const result = await service.approve(
        req.id,
        'sup-uuid-1',
        UserRole.SUPERVISOR,
        { comments: 'Approved — valid request' },
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.PENDING_FULFILLMENT);

      // Audit log
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REQUISITION_APPROVED }),
      );

      // Requester notification
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        req.requestedById,
        NotificationAlertType.REQUISITION_APPROVED,
        expect.any(String),
        expect.any(String),
        req.id,
        'requisition',
      );

      // IT Personnel notification
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        'it-user-1',
        NotificationAlertType.PENDING_APPROVAL,
        expect.any(String),
        expect.any(String),
        req.id,
        'requisition',
      );
    });

    it('throws 400 if requisition is not in PENDING_SUPERVISOR state', async () => {
      const req = makeReq({ status: RequisitionStatus.FULFILLED });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.approve(
          req.id,
          'sup-uuid-1',
          UserRole.SUPERVISOR,
          {},
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('throws 403 if a different supervisor tries to approve', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_SUPERVISOR,
        supervisorId: 'sup-uuid-1',
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.approve(
          req.id,
          'different-sup',
          UserRole.SUPERVISOR,
          {},
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    // ── SYSTEM_ADMIN ownership bypass (Fix 4) ────────────────────────────────
    it('allows SYSTEM_ADMIN to approve on behalf of a different nominated supervisor', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_SUPERVISOR,
        supervisorId: 'sup-uuid-1',
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockApprovalRepo.create.mockReturnValue({});
      mockApprovalRepo.save.mockResolvedValue({});
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.PENDING_FULFILLMENT,
      });

      await expect(
        service.approve(
          req.id,
          'admin-uuid-1',
          UserRole.SYSTEM_ADMIN,
          {},
          '127.0.0.1',
        ),
      ).resolves.toMatchObject({
        status: RequisitionStatus.PENDING_FULFILLMENT,
      });
    });
  });

  describe('reject() — supervisor rejection flow', () => {
    it('transitions status to REJECTED and notifies requester', async () => {
      const req = makeReq({ status: RequisitionStatus.PENDING_SUPERVISOR });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockApprovalRepo.create.mockReturnValue({});
      mockApprovalRepo.save.mockResolvedValue({});
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.REJECTED,
      });

      const result = await service.reject(
        req.id,
        'sup-uuid-1',
        UserRole.SUPERVISOR,
        { comments: 'Budget exceeded' },
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.REJECTED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REQUISITION_REJECTED }),
      );
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        req.requestedById,
        NotificationAlertType.REQUISITION_REJECTED,
        expect.any(String),
        expect.any(String),
        req.id,
        'requisition',
      );
    });

    it('throws 400 if not in PENDING_SUPERVISOR state', async () => {
      const req = makeReq({ status: RequisitionStatus.FULFILLED });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.reject(
          req.id,
          'sup-1',
          UserRole.SUPERVISOR,
          { comments: 'No' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Ownership guard, closing the authorization gap (Fix 4) ──────────────
    it('throws 403 if a different supervisor tries to reject', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_SUPERVISOR,
        supervisorId: 'sup-uuid-1',
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.reject(
          req.id,
          'different-sup',
          UserRole.SUPERVISOR,
          { comments: 'No' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockReqRepo.save).not.toHaveBeenCalled();
    });

    it('allows SYSTEM_ADMIN to reject on behalf of a different nominated supervisor', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_SUPERVISOR,
        supervisorId: 'sup-uuid-1',
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockApprovalRepo.create.mockReturnValue({});
      mockApprovalRepo.save.mockResolvedValue({});
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.REJECTED,
      });

      await expect(
        service.reject(
          req.id,
          'admin-uuid-1',
          UserRole.SYSTEM_ADMIN,
          { comments: 'Not justified' },
          '127.0.0.1',
        ),
      ).resolves.toMatchObject({ status: RequisitionStatus.REJECTED });
    });
  });

  describe('fulfill() — IT Personnel fulfillment flow', () => {
    it('transitions PENDING_FULFILLMENT → FULFILLED and notifies requester', async () => {
      const req = makeReq({ status: RequisitionStatus.PENDING_FULFILLMENT });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.FULFILLED,
      });

      const result = await service.fulfill(
        req.id,
        'it-uuid-1',
        UserRole.IT_PERSONNEL,
        { notes: 'Issued Dell Laptop SN-1234' },
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.FULFILLED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REQUISITION_FULFILLED }),
      );
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        req.requestedById,
        NotificationAlertType.REQUISITION_FULFILLED,
        expect.any(String),
        expect.any(String),
        req.id,
        'requisition',
      );
    });

    it('also fulfills ON_HOLD requisitions', async () => {
      const req = makeReq({ status: RequisitionStatus.ON_HOLD });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.FULFILLED,
      });

      const result = await service.fulfill(
        req.id,
        'it-1',
        UserRole.IT_PERSONNEL,
        {},
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.FULFILLED);
    });

    it('throws 400 if requisition is not fulfillable', async () => {
      const req = makeReq({ status: RequisitionStatus.REJECTED });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.fulfill(req.id, 'it-1', UserRole.IT_PERSONNEL, {}, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Whole-requisition scope enforcement (Fix 2) ──────────────────────────
    it('allows IT_PERSONNEL to fulfill a requisition whose items are all ICT', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items: [
          { itemDescription: 'Laptop', assetType: AssetType.ICT },
        ] as unknown as RequisitionItemEntity[],
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.FULFILLED,
      });

      await expect(
        service.fulfill(req.id, 'it-1', UserRole.IT_PERSONNEL, {}, '127.0.0.1'),
      ).resolves.toMatchObject({ status: RequisitionStatus.FULFILLED });
    });

    it('throws ForbiddenException when IT_PERSONNEL tries to fulfill a requisition containing a Fixed item', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items: [
          { itemDescription: 'Office Chair', assetType: AssetType.FIXED },
        ] as unknown as RequisitionItemEntity[],
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.fulfill(req.id, 'it-1', UserRole.IT_PERSONNEL, {}, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockReqRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when PROPERTY_CUSTODIAN tries to fulfill a requisition with a mixed ICT + Fixed item set', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items: [
          { itemDescription: 'Office Chair', assetType: AssetType.FIXED },
          { itemDescription: 'Laptop', assetType: AssetType.ICT },
        ] as unknown as RequisitionItemEntity[],
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.fulfill(
          req.id,
          'pc-1',
          UserRole.PROPERTY_CUSTODIAN,
          {},
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('fulfill() — supply stock decrement', () => {
    // A line item that clears the IT_PERSONNEL asset-type scope guard
    // (assetType ICT) so the test reaches the decrement path. assetClass
    // decides whether the supply is decremented — IES yes, PPE/SEP no.
    const mkItem = (
      over: Partial<RequisitionItemEntity> = {},
    ): RequisitionItemEntity =>
      ({
        id: 'ri-ies-1',
        assetType: AssetType.ICT,
        assetClass: AssetClass.IES,
        quantity: 4,
        itemDescription: 'USB drives (box)',
        fulfilledAssetId: null,
        ...over,
      }) as unknown as RequisitionItemEntity;

    const armFulfillable = (items: RequisitionItemEntity[]) => {
      const req = makeReq({
        id: 'req-supply-1',
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items,
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockReqRepo.save.mockImplementation((r: RequisitionEntity) =>
        Promise.resolve(r),
      );
      return req;
    };

    it('decrements the linked IES supply by the line quantity and records stockDecrements in the audit metadata', async () => {
      armFulfillable([mkItem({ quantity: 4 })]);
      mockAssetRepo.findOne.mockResolvedValue({
        id: 'sup-1',
        assetClass: AssetClass.IES,
        quantity: 10,
      });
      mockAssetRepo.save.mockImplementation((a: AssetEntity) =>
        Promise.resolve(a),
      );

      await service.fulfill(
        'req-supply-1',
        'it-1',
        UserRole.IT_PERSONNEL,
        {
          fulfilledItems: [{ requisitionItemId: 'ri-ies-1', assetId: 'sup-1' }],
        },
        '127.0.0.1',
      );

      expect(mockAssetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sup-1', quantity: 6 }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REQUISITION_FULFILLED,
          metadata: expect.objectContaining({
            stockDecrements: [{ assetId: 'sup-1', from: 10, to: 6 }],
          }),
        }),
      );
      expect(
        mockAssetsService.notifyLowStockIfBelowThreshold,
      ).toHaveBeenCalledWith('sup-1');
    });

    it('rolls back with a 400 and saves nothing when the line quantity exceeds available stock', async () => {
      armFulfillable([mkItem({ quantity: 50 })]);
      mockAssetRepo.findOne.mockResolvedValue({
        id: 'sup-1',
        assetClass: AssetClass.IES,
        quantity: 10,
      });

      await expect(
        service.fulfill(
          'req-supply-1',
          'it-1',
          UserRole.IT_PERSONNEL,
          {
            fulfilledItems: [
              { requisitionItemId: 'ri-ies-1', assetId: 'sup-1' },
            ],
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow('Insufficient stock: requested 50, available 10');

      expect(mockAssetRepo.save).not.toHaveBeenCalled();
      expect(mockReqRepo.save).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
      expect(
        mockAssetsService.notifyLowStockIfBelowThreshold,
      ).not.toHaveBeenCalled();
    });

    it('leaves a PPE line untouched — no supply lookup, no decrement, empty stockDecrements', async () => {
      armFulfillable([
        mkItem({
          id: 'ri-ppe-1',
          assetClass: AssetClass.PPE,
          quantity: 1,
          itemDescription: 'Laptop',
        }),
      ]);

      await service.fulfill(
        'req-supply-1',
        'it-1',
        UserRole.IT_PERSONNEL,
        {
          fulfilledItems: [{ requisitionItemId: 'ri-ppe-1', assetId: 'ppe-1' }],
        },
        '127.0.0.1',
      );

      expect(mockAssetRepo.findOne).not.toHaveBeenCalled();
      expect(mockAssetRepo.save).not.toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REQUISITION_FULFILLED,
          metadata: expect.objectContaining({ stockDecrements: [] }),
        }),
      );
    });

    it('still fulfills via the legacy path when no fulfilledItems are supplied', async () => {
      armFulfillable([mkItem()]);

      const result = await service.fulfill(
        'req-supply-1',
        'it-1',
        UserRole.IT_PERSONNEL,
        {},
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.FULFILLED);
      expect(mockAssetRepo.findOne).not.toHaveBeenCalled();
      expect(
        mockAssetsService.notifyLowStockIfBelowThreshold,
      ).not.toHaveBeenCalled();
    });
  });

  describe('putOnHold() — IT Personnel / Property Custodian hold flow', () => {
    it('transitions PENDING_FULFILLMENT → ON_HOLD when all items are in scope', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items: [
          { itemDescription: 'Laptop', assetType: AssetType.ICT },
        ] as unknown as RequisitionItemEntity[],
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);
      mockReqRepo.save.mockResolvedValue({
        ...req,
        status: RequisitionStatus.ON_HOLD,
      });

      const result = await service.putOnHold(
        req.id,
        'it-1',
        UserRole.IT_PERSONNEL,
        'Awaiting new stock',
        '127.0.0.1',
      );

      expect(result.status).toBe(RequisitionStatus.ON_HOLD);
    });

    it('throws ForbiddenException when PROPERTY_CUSTODIAN tries to hold a requisition with an ICT item outside their scope', async () => {
      const req = makeReq({
        status: RequisitionStatus.PENDING_FULFILLMENT,
        items: [
          { itemDescription: 'Laptop', assetType: AssetType.ICT },
        ] as unknown as RequisitionItemEntity[],
      });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.putOnHold(
          req.id,
          'pc-1',
          UserRole.PROPERTY_CUSTODIAN,
          'Unavailable',
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockReqRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('throws NotFoundException for unknown requisition ID', async () => {
      mockReqRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findOne('no-such-id', 'user-1', UserRole.SYSTEM_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('attaches approval history to the result', async () => {
      const req = makeReq();
      const approvals = [{ id: 'ap-1', action: 'approved' }];
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue(approvals);

      const result = await service.findOne(
        req.id,
        'user-1',
        UserRole.IT_PERSONNEL,
      );
      expect((result as any).approvals).toEqual(approvals);
    });

    it('allows an Employee to view their own requisition', async () => {
      const req = makeReq({ requestedById: 'emp-1' });
      mockReqRepo.findOne.mockResolvedValue(req);
      mockApprovalRepo.find.mockResolvedValue([]);

      await expect(
        service.findOne(req.id, 'emp-1', UserRole.EMPLOYEE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when Employee tries to view another user requisition', async () => {
      const req = makeReq({ requestedById: 'emp-owner' });
      mockReqRepo.findOne.mockResolvedValue(req);

      await expect(
        service.findOne(req.id, 'emp-different', UserRole.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getStats() ────────────────────────────────────────────────────────────
  describe('getStats()', () => {
    const makeStatsQb = (rawRows: { status: string; count: string }[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawRows),
    });

    it('returns stats scoped to employee (own requests only)', async () => {
      const qb = makeStatsQb([
        { status: RequisitionStatus.PENDING_SUPERVISOR, count: '2' },
        { status: RequisitionStatus.FULFILLED, count: '3' },
      ]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('emp-1', UserRole.EMPLOYEE);

      expect(qb.where).toHaveBeenCalledWith('r.requestedById = :userId', {
        userId: 'emp-1',
      });
      expect(result.total).toBe(5);
      expect(result.pending).toBe(2);
      expect(result.fulfilled).toBe(3);
      expect(result.rejected).toBe(0);
      expect(result.onHold).toBe(0);
    });

    it('scopes supervisor stats to their own requests', async () => {
      const qb = makeStatsQb([
        { status: RequisitionStatus.PENDING_SUPERVISOR, count: '1' },
        { status: RequisitionStatus.REJECTED, count: '1' },
      ]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('sup-1', UserRole.SUPERVISOR);

      expect(qb.where).toHaveBeenCalledWith('r.requestedById = :userId', {
        userId: 'sup-1',
      });
      expect(result.total).toBe(2);
      expect(result.rejected).toBe(1);
    });

    it('returns asset-type-scoped stats for IT Personnel (ICT only, no requestedById filter)', async () => {
      const qb = makeStatsQb([
        { status: RequisitionStatus.PENDING_FULFILLMENT, count: '4' },
        { status: RequisitionStatus.ON_HOLD, count: '2' },
        { status: RequisitionStatus.REJECTED, count: '1' },
      ]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('it-1', UserRole.IT_PERSONNEL);

      expect(qb.where).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ri.asset_type IN (:...statsScope)'),
        { statsScope: [AssetType.ICT] },
      );
      expect(result.total).toBe(7);
      expect(result.approved).toBe(4);
      expect(result.onHold).toBe(2);
      expect(result.rejected).toBe(1);
    });

    it('scopes PROPERTY_CUSTODIAN stats to Fixed/Supplies asset types', async () => {
      const qb = makeStatsQb([
        { status: RequisitionStatus.PENDING_FULFILLMENT, count: '1' },
      ]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getStats('pc-1', UserRole.PROPERTY_CUSTODIAN);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ri.asset_type IN (:...statsScope)'),
        { statsScope: [AssetType.FIXED, AssetType.SUPPLIES] },
      );
    });

    it('returns all-zero stats when no requisitions exist (SYSTEM_ADMIN — unscoped)', async () => {
      const qb = makeStatsQb([]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('admin-1', UserRole.SYSTEM_ADMIN);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        fulfilled: 0,
        onHold: 0,
      });
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    const makeListQb = () => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    it('scopes to own requisitions for EMPLOYEE role', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('emp-1', UserRole.EMPLOYEE);

      expect(qb.where).toHaveBeenCalledWith('r.requestedById = :id', {
        id: 'emp-1',
      });
    });

    it('scopes to pending-approval queue for SUPERVISOR role', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('sup-1', UserRole.SUPERVISOR);

      expect(qb.where).toHaveBeenCalledWith(
        'r.supervisorId = :id AND r.status = :status',
        { id: 'sup-1', status: RequisitionStatus.PENDING_SUPERVISOR },
      );
    });

    it('scopes to fulfillment queue with ICT-only items for IT_PERSONNEL role', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('it-1', UserRole.IT_PERSONNEL);

      expect(qb.where).toHaveBeenCalledWith('r.status IN (:...statuses)', {
        statuses: [
          RequisitionStatus.PENDING_FULFILLMENT,
          RequisitionStatus.ON_HOLD,
        ],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type = :itScope)',
        { itScope: AssetType.ICT },
      );
    });

    it('scopes to fulfillment queue with Fixed/Supplies items for PROPERTY_CUSTODIAN role', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('pc-1', UserRole.PROPERTY_CUSTODIAN);

      expect(qb.where).toHaveBeenCalledWith('r.status IN (:...statuses)', {
        statuses: [
          RequisitionStatus.PENDING_FULFILLMENT,
          RequisitionStatus.ON_HOLD,
        ],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type IN (:...pcScope))',
        { pcScope: [AssetType.FIXED, AssetType.SUPPLIES] },
      );
    });

    it('scopes PROPERTY_OFFICER to Fixed/Supplies items across all statuses', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('po-1', UserRole.PROPERTY_OFFICER);

      expect(qb.where).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type IN (:...poScope))',
        { poScope: [AssetType.FIXED, AssetType.SUPPLIES] },
      );
    });

    it('returns all requisitions for SYSTEM_ADMIN without role filter', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('admin-1', UserRole.SYSTEM_ADMIN);

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('applies statusFilter via andWhere when provided', async () => {
      const qb = makeListQb();
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('emp-1', UserRole.EMPLOYEE, 1, 20, 'fulfilled');

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :sf', {
        sf: 'fulfilled',
      });
    });

    it('returns pagination metadata', async () => {
      const reqs = [makeReq(), makeReq({ id: 'req-2' })];
      const qb = makeListQb();
      qb.getManyAndCount.mockResolvedValue([reqs, 2]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(
        'admin-1',
        UserRole.SYSTEM_ADMIN,
        1,
        20,
      );

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  // ── checkSlaBreaches() — SLA breach watcher (dedup stamp + oversight roles) ──
  describe('checkSlaBreaches()', () => {
    // Inspectable QueryBuilder mock — chain calls are real jest.fn()s so a test
    // can assert the dedup filter clause was actually applied to the query.
    const makeBreachQb = (rows: RequisitionEntity[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });

    it('notifies supervisor, requester, every system_admin and every management user once, then stamps the requisition', async () => {
      const breached = makeReq({
        id: 'r1',
        requestNumber: 'REQ-1',
        supervisorId: 'sup1',
        requestedById: 'emp1',
        status: RequisitionStatus.PENDING_SUPERVISOR,
        slaDeadline: new Date(Date.now() - 60_000),
        slaBreachNotifiedAt: null,
      });
      const qb = makeBreachQb([breached]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);
      const usersByRole: Partial<Record<UserRole, { id: string }[]>> = {
        [UserRole.SYSTEM_ADMIN]: [{ id: 'admin1' }],
        [UserRole.MANAGEMENT]: [{ id: 'mgmt1' }],
      };
      mockUsersService.findByRole.mockImplementation((r: UserRole) =>
        Promise.resolve(usersByRole[r] ?? []),
      );
      mockReqRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkSlaBreaches();

      expect(count).toBe(1);

      // Dedup query-filter must be present — without this clause the watcher
      // would re-alert an already-stamped requisition on every sweep, which is
      // the whole point of the task.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('slaBreachNotifiedAt IS NULL'),
      );

      const recipients = mockNotifService.notify.mock.calls.map((c) =>
        String(c[0]),
      );
      expect(recipients.sort()).toEqual(['admin1', 'emp1', 'mgmt1', 'sup1']);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        expect.any(String),
        NotificationAlertType.SLA_BREACH,
        expect.any(String),
        expect.any(String),
        'r1',
        'requisition',
      );
      expect(mockReqRepo.update).toHaveBeenCalledWith('r1', {
        slaBreachNotifiedAt: expect.any(Date),
      });
    });

    it('collapses a recipient who is both requester and system_admin into a single notify', async () => {
      const breached = makeReq({
        id: 'r2',
        requestNumber: 'REQ-2',
        supervisorId: 'sup2',
        requestedById: 'dual-user',
        status: RequisitionStatus.PENDING_SUPERVISOR,
        slaDeadline: new Date(Date.now() - 60_000),
        slaBreachNotifiedAt: null,
      });
      mockReqRepo.createQueryBuilder.mockReturnValue(makeBreachQb([breached]));
      const usersByRole: Partial<Record<UserRole, { id: string }[]>> = {
        [UserRole.SYSTEM_ADMIN]: [{ id: 'dual-user' }],
        [UserRole.MANAGEMENT]: [],
      };
      mockUsersService.findByRole.mockImplementation((r: UserRole) =>
        Promise.resolve(usersByRole[r] ?? []),
      );
      mockReqRepo.update.mockResolvedValue({ affected: 1 });

      await service.checkSlaBreaches();

      const dualUserCalls = mockNotifService.notify.mock.calls.filter(
        (c) => String(c[0]) === 'dual-user',
      );
      expect(dualUserCalls).toHaveLength(1);
      // Distinct recipients left: the supervisor + the merged requester/admin.
      expect(mockNotifService.notify).toHaveBeenCalledTimes(2);
    });

    it('skips requisitions already stamped (query filters them out) and returns 0', async () => {
      mockReqRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await expect(service.checkSlaBreaches()).resolves.toBe(0);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockReqRepo.update).not.toHaveBeenCalled();
    });
  });

  // ── checkPendingApprovalNudges() — half-SLA pending-approval nudge watcher ──
  describe('checkPendingApprovalNudges()', () => {
    const halfSlaMs = (SLA_APPROVAL_HOURS / 2) * 60 * 60 * 1_000;

    // Inspectable QueryBuilder mock — chain calls are real jest.fn()s so a test
    // can assert the dedup + window filter clauses were actually applied.
    const makeNudgeQb = (rows: RequisitionEntity[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });

    it('nudges the supervisor once for a requisition pending past half the SLA but not yet breached, then stamps it', async () => {
      const req = makeReq({
        id: 'r1',
        requestNumber: 'REQ-1',
        supervisorId: 'sup1',
        status: RequisitionStatus.PENDING_SUPERVISOR,
        submittedAt: new Date(Date.now() - halfSlaMs - 60_000),
        slaDeadline: new Date(Date.now() + 60_000),
        pendingNudgeNotifiedAt: null,
      });
      const qb = makeNudgeQb([req]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);
      mockReqRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkPendingApprovalNudges();

      expect(count).toBe(1);

      // Dedup query-filter must be present — without this clause the watcher
      // would re-nudge an already-stamped requisition on every hourly sweep.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('pendingNudgeNotifiedAt IS NULL'),
      );

      expect(mockNotifService.notify).toHaveBeenCalledTimes(1);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        'sup1',
        NotificationAlertType.PENDING_APPROVAL,
        expect.stringContaining('Approaching'),
        expect.stringContaining('REQ-1'),
        'r1',
        'requisition',
      );
      expect(mockReqRepo.update).toHaveBeenCalledWith('r1', {
        pendingNudgeNotifiedAt: expect.any(Date),
      });
    });

    it('bounds the query to submissions older than half the SLA and deadlines not yet passed', async () => {
      const qb = makeNudgeQb([]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const before = Date.now();
      await service.checkPendingApprovalNudges();
      const after = Date.now();

      // Lower bound: only submissions older than SLA_APPROVAL_HOURS/2 — an
      // 11h59m-pending requisition is still inside the window and must NOT be
      // selected. Widening/removing this clause would fail here.
      const thresholdCall = qb.andWhere.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' &&
          c[0].includes('submittedAt < :nudgeThreshold'),
      );
      expect(thresholdCall).toBeDefined();
      const nudgeThreshold = (
        thresholdCall![1] as { nudgeThreshold: Date }
      ).nudgeThreshold.getTime();
      expect(nudgeThreshold).toBeGreaterThanOrEqual(before - halfSlaMs - 50);
      expect(nudgeThreshold).toBeLessThanOrEqual(after - halfSlaMs + 50);

      // Upper bound: already-breached requisitions belong to checkSlaBreaches.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('slaDeadline >= :now'),
        expect.objectContaining({ now: expect.any(Date) }),
      );
    });

    it('returns 0 and notifies nobody when the query yields nothing', async () => {
      mockReqRepo.createQueryBuilder.mockReturnValue(makeNudgeQb([]));

      await expect(service.checkPendingApprovalNudges()).resolves.toBe(0);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockReqRepo.update).not.toHaveBeenCalled();
    });

    it('stamps but does not notify when the pending requisition has no nominated supervisor', async () => {
      const req = makeReq({
        id: 'r3',
        requestNumber: 'REQ-3',
        supervisorId: null,
        status: RequisitionStatus.PENDING_SUPERVISOR,
        submittedAt: new Date(Date.now() - halfSlaMs - 60_000),
        slaDeadline: new Date(Date.now() + 60_000),
        pendingNudgeNotifiedAt: null,
      });
      mockReqRepo.createQueryBuilder.mockReturnValue(makeNudgeQb([req]));
      mockReqRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkPendingApprovalNudges();

      expect(count).toBe(1);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockReqRepo.update).toHaveBeenCalledWith('r3', {
        pendingNudgeNotifiedAt: expect.any(Date),
      });
    });
  });
});
