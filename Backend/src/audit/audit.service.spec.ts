import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';

describe('AuditService', () => {
  let service: AuditService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo },
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
      mockRepo.findAndCount.mockResolvedValue([[{ id: 'a1' }], 1]);
      const result = await service.findAll(1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { timestamp: 'DESC' } }),
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
});
