import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
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

  const mockAssetRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
        { provide: getRepositoryToken(AssetEntity), useValue: mockAssetRepo },
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
