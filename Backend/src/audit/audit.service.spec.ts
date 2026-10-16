import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetRequestEntity } from '../asset-requests/entities/asset-request.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { GeneratedFormEntity } from '../reports/entities/generated-form.entity';
import {
  AssetType,
  AuditAction,
  UserRole,
} from '../../../packages/shared/src/enums';

describe('AuditService', () => {
  let service: AuditService;

  const mockQb = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
  };

  const mockAssetRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockUserRepo = { find: jest.fn() };
  const mockRequestRepo = { find: jest.fn() };
  const mockRequisitionRepo = { find: jest.fn() };
  const mockFormRepo = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
        { provide: getRepositoryToken(AssetEntity), useValue: mockAssetRepo },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(AssetRequestEntity),
          useValue: mockRequestRepo,
        },
        {
          provide: getRepositoryToken(RequisitionEntity),
          useValue: mockRequisitionRepo,
        },
        {
          provide: getRepositoryToken(GeneratedFormEntity),
          useValue: mockFormRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  // ── log() — APPEND-ONLY ───────────────────────────────────────────────────
  describe('log()', () => {
    it('creates and saves an audit log entry', async () => {
      const entry = { id: 'audit-1' };
      mockRepo.create.mockReturnValue(entry);
      mockRepo.save.mockResolvedValue(entry);

      const result = await service.log({
        userId: 'user-1',
        userRole: UserRole.IT_PERSONNEL,
        action: AuditAction.ASSET_ISSUED,
        affectedRecordId: 'asset-1',
        affectedRecordType: 'asset',
        ipAddress: '127.0.0.1',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: AuditAction.ASSET_ISSUED,
        }),
      );
      expect(result).toEqual(entry);
    });

    it('accepts optional metadata and userAgent', async () => {
      const entry = { id: 'audit-2' };
      mockRepo.create.mockReturnValue(entry);
      mockRepo.save.mockResolvedValue(entry);

      await service.log({
        userId: 'u',
        userRole: UserRole.SUPERVISOR,
        action: AuditAction.REQUISITION_APPROVED,
        affectedRecordId: 'r-1',
        affectedRecordType: 'requisition',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: { comments: 'Approved' },
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll()', () => {
    it('returns paginated audit logs newest first', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[{ id: 'a1' }], 1]);
      const result = await service.findAll(1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockQb.orderBy).toHaveBeenCalledWith('a.timestamp', 'DESC');
    });

    it('filters by action via andWhere', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, 'user_login');
      expect(mockQb.andWhere).toHaveBeenCalledWith('a.action = :action', {
        action: 'user_login',
      });
    });

    it('lower-bounds a date-only startDate at the start of that UTC day', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, '2026-09-01');
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'a.timestamp >= :startDate',
        {
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      );
    });

    it('upper-bounds a date-only endDate at the end of that UTC day (inclusive)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, undefined, '2026-09-30');
      expect(mockQb.andWhere).toHaveBeenCalledWith('a.timestamp <= :endDate', {
        endDate: new Date('2026-09-30T23:59:59.999Z'),
      });
    });

    it('ignores an unparseable date bound instead of filtering on Invalid Date', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 20, undefined, 'not-a-date');
      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        'a.timestamp >= :startDate',
        expect.anything(),
      );
    });
  });

  // The audit screens printed "User ID 54a576d7-..." and "asset_request
  // 017fa908…": true, and useless to someone reading them. Entries are now
  // handed out with the person's name and a label for the record.
  describe('withNames()', () => {
    const entry = (over: Record<string, unknown> = {}) => ({
      id: 'e-1',
      userId: 'u-1',
      action: AuditAction.USER_LOGIN,
      affectedRecordType: 'users',
      affectedRecordId: 'u-1',
      ...over,
    });

    beforeEach(() => {
      mockUserRepo.find.mockResolvedValue([
        {
          id: 'u-1',
          firstName: 'Ana',
          lastName: 'Reyes',
          employeeId: 'CICC-IT-001',
        },
      ]);
      mockRequestRepo.find.mockResolvedValue([
        { id: 'r-1', requestNumber: 'AR-2026-0014' },
      ]);
      mockRequisitionRepo.find.mockResolvedValue([
        { id: 'q-1', requestNumber: 'REQ-2026-0003' },
      ]);
      mockFormRepo.find.mockResolvedValue([
        { id: 'f-1', formType: 'PAR', documentNumber: 'PAR-2026-0007' },
        { id: 'f-2', formType: 'RPCI', documentNumber: null },
      ]);
      mockAssetRepo.find.mockResolvedValue([
        {
          id: 'a-1',
          itemDescription: 'Dell Latitude 5440 Laptop',
          propertyNumber: 'DEMO-ICT-0003',
        },
      ]);
    });

    it('names whoever did it', async () => {
      const [out] = await service.withNames([entry() as never]);

      expect(out).toMatchObject({ id: 'e-1', userName: 'Ana Reyes' });
    });

    it('leaves the name empty for an account that no longer resolves', async () => {
      const [out] = await service.withNames([
        entry({ userId: 'u-gone' }) as never,
      ]);

      expect(out.userName).toBeNull();
    });

    it.each([
      ['asset_request', 'r-1', 'AR-2026-0014'],
      ['requisition', 'q-1', 'REQ-2026-0003'],
      ['asset', 'a-1', 'Dell Latitude 5440 Laptop (DEMO-ICT-0003)'],
      ['users', 'u-1', 'Ana Reyes (CICC-IT-001)'],
      ['form', 'f-1', 'PAR-2026-0007'],
      ['form', 'f-2', 'RPCI'],
    ])('labels a %s record', async (type, id, label) => {
      const [out] = await service.withNames([
        entry({ affectedRecordType: type, affectedRecordId: id }) as never,
      ]);

      expect(out.recordLabel).toBe(label);
    });

    it('has no label for a record it cannot describe', async () => {
      const [out] = await service.withNames([
        entry({
          affectedRecordType: 'system_config',
          affectedRecordId: 'c-1',
        }) as never,
      ]);

      expect(out.recordLabel).toBeNull();
    });

    it('looks each kind up once for the whole page, and nothing for an empty one', async () => {
      await service.withNames([
        entry({ affectedRecordType: 'asset_request', affectedRecordId: 'r-1' }),
        entry({ affectedRecordType: 'asset_request', affectedRecordId: 'r-1' }),
        entry({ affectedRecordType: 'requisition', affectedRecordId: 'q-1' }),
      ] as never);

      expect(mockUserRepo.find).toHaveBeenCalledTimes(1);
      expect(mockRequestRepo.find).toHaveBeenCalledTimes(1);
      expect(mockRequisitionRepo.find).toHaveBeenCalledTimes(1);
      expect(mockAssetRepo.find).not.toHaveBeenCalled();
      expect(mockFormRepo.find).not.toHaveBeenCalled();

      jest.clearAllMocks();
      expect(await service.withNames([])).toEqual([]);
      expect(mockUserRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findByUser()', () => {
    it('filters audit logs by userId', async () => {
      mockRepo.findAndCount.mockResolvedValue([
        [{ id: 'a2', userId: 'user-1' }],
        1,
      ]);
      const result = await service.findByUser('user-1', 1, 20);
      expect(result.total).toBe(1);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  describe('findByRecord()', () => {
    it('returns all audit logs for a specific record ordered by timestamp ASC', async () => {
      mockRepo.find.mockResolvedValue([
        { id: 'a3', affectedRecordId: 'asset-1' },
      ]);
      const result = await service.findByRecord('asset-1');
      expect(result).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { affectedRecordId: 'asset-1' },
          order: { timestamp: 'ASC' },
        }),
      );
    });
  });

  // GET /audit/record/:id used to hand ANY record's history (including a
  // user's own login/IP trail, which has the user id as its record id) to every
  // role allowed on the route, bypassing the admin-only /audit/user/:id.
  describe('findRecordHistory() — who may read which record', () => {
    const history = [{ id: 'a9', affectedRecordId: 'rec-1' }];
    beforeEach(() => mockRepo.find.mockResolvedValue(history));

    it.each([UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT])(
      '%s may read any record (they already see the whole trail)',
      async (role) => {
        await expect(service.findRecordHistory('rec-1', role)).resolves.toBe(
          history,
        );
        expect(mockAssetRepo.findOne).not.toHaveBeenCalled();
      },
    );

    it('IT personnel may read the history of an ICT asset', async () => {
      mockAssetRepo.findOne.mockResolvedValue({ id: 'rec-1' });
      await expect(
        service.findRecordHistory('rec-1', UserRole.IT_PERSONNEL),
      ).resolves.toBe(history);
      expect(mockAssetRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1', assetType: In([AssetType.ICT]) },
        }),
      );
    });

    it.each([UserRole.PROPERTY_CUSTODIAN, UserRole.PROPERTY_OFFICER])(
      '%s is looked up against Fixed + Supplies only',
      async (role) => {
        mockAssetRepo.findOne.mockResolvedValue({ id: 'rec-1' });
        await service.findRecordHistory('rec-1', role);
        expect(mockAssetRepo.findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: 'rec-1',
              assetType: In([AssetType.FIXED, AssetType.SUPPLIES]),
            },
          }),
        );
      },
    );

    it('a record that is not an in-scope asset (a user id, an out-of-scope asset) is refused without reading any audit rows', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findRecordHistory('some-user-id', UserRole.IT_PERSONNEL),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it.each([UserRole.EMPLOYEE, UserRole.SUPERVISOR])(
      'a role with no asset scope and no oversight duty (%s) is refused (default-deny)',
      async (role) => {
        await expect(service.findRecordHistory('rec-1', role)).rejects.toThrow(
          ForbiddenException,
        );
        expect(mockAssetRepo.findOne).not.toHaveBeenCalled();
        expect(mockRepo.find).not.toHaveBeenCalled();
      },
    );
  });
});
