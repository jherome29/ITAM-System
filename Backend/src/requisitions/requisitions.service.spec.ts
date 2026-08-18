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
} from '../../../packages/shared/src/enums';

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
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as RequisitionEntity;

describe('RequisitionsService', () => {
  let service: RequisitionsService;

  // ── Mock repositories ─────────────────────────────────────────────────────
  const mockReqRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
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

  const mockItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

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
        supervisorId: 'sup-uuid-1',
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

    it('returns system-wide stats for IT Personnel (no scope filter)', async () => {
      const qb = makeStatsQb([
        { status: RequisitionStatus.PENDING_FULFILLMENT, count: '4' },
        { status: RequisitionStatus.ON_HOLD, count: '2' },
        { status: RequisitionStatus.REJECTED, count: '1' },
      ]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('it-1', UserRole.IT_PERSONNEL);

      expect(qb.where).not.toHaveBeenCalled();
      expect(result.total).toBe(7);
      expect(result.approved).toBe(4);
      expect(result.onHold).toBe(2);
      expect(result.rejected).toBe(1);
    });

    it('returns all-zero stats when no requisitions exist', async () => {
      const qb = makeStatsQb([]);
      mockReqRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('admin-1', UserRole.SYSTEM_ADMIN);

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
        statuses: [RequisitionStatus.PENDING_FULFILLMENT, RequisitionStatus.ON_HOLD],
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
        statuses: [RequisitionStatus.PENDING_FULFILLMENT, RequisitionStatus.ON_HOLD],
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
});
