import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemConfigService } from '../system-config/system-config.service';
import {
  AssetStatus,
  AssetClass,
  AssetType,
  AssetCondition,
  UserRole,
  AuditAction,
  NotificationAlertType,
} from '../../../packages/shared/src/enums';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeAsset = (overrides: Partial<AssetEntity> = {}): AssetEntity =>
  ({
    id: 'asset-uuid-1',
    itemDescription: 'Laptop Dell XPS',
    assetClass: AssetClass.PPE,
    assetType: AssetType.ICT,
    condition: AssetCondition.SERVICEABLE,
    status: AssetStatus.AVAILABLE,
    custodianId: null,
    propertyNumber: 'PROP-001',
    serialNumber: 'SN-12345',
    locationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as AssetEntity;

describe('AssetsService', () => {
  let service: AssetsService;

  const mockAssetRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTxRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockUsersService = {
    findByEmployeeId: jest.fn(),
    findByRole: jest.fn(),
  };

  const mockNotifService = {
    notify: jest.fn(),
  };

  // Default to the shared-constant fallback (10) so every existing test is
  // unchanged; one test overrides it to prove the value is read from config.
  const mockSystemConfig = {
    getDefaultReorderLevel: jest.fn(() => 10),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(AssetEntity), useValue: mockAssetRepo },
        {
          provide: getRepositoryToken(AssetTransactionEntity),
          useValue: mockTxRepo,
        },
        { provide: AuditService, useValue: mockAuditService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: NotificationsService, useValue: mockNotifService },
        { provide: SystemConfigService, useValue: mockSystemConfig },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();

    // clearAllMocks() clears call history but not implementations; re-assert
    // the default so a per-test mockReturnValue override never leaks.
    mockSystemConfig.getDefaultReorderLevel.mockReturnValue(10);
  });

  // ── Section 12.1 — Asset registration ────────────────────────────────────
  describe('create()', () => {
    it('creates asset with REGISTERED status and logs audit entry', async () => {
      const dto = {
        itemDescription: 'Laptop',
        assetClass: AssetClass.PPE,
        assetType: AssetType.ICT,
        condition: AssetCondition.SERVICEABLE,
      } as any;

      const created = makeAsset({ status: AssetStatus.REGISTERED });
      mockAssetRepo.create.mockReturnValue(created);
      mockAssetRepo.save.mockResolvedValue(created);

      const result = await service.create(
        dto,
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(result.status).toBe(AssetStatus.REGISTERED);

      // Section 12.3 — audit log must be created
      expect(mockAuditService.log).toHaveBeenCalledTimes(1);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSET_CREATED,
          userRole: UserRole.IT_PERSONNEL,
          affectedRecordType: 'asset',
        }),
      );
    });

    // ── Fix 1 — create-time scope enforcement ─────────────────────────────
    it('throws ForbiddenException when dto.assetType is outside the caller scope', async () => {
      const dto = {
        itemDescription: 'Laptop',
        assetClass: AssetClass.PPE,
        assetType: AssetType.ICT,
        condition: AssetCondition.SERVICEABLE,
      } as any;

      await expect(
        service.create(dto, 'pc-1', UserRole.PROPERTY_CUSTODIAN, '127.0.0.1', [
          AssetType.FIXED,
          AssetType.SUPPLIES,
        ]),
      ).rejects.toThrow(ForbiddenException);
      expect(mockAssetRepo.save).not.toHaveBeenCalled();
    });

    it('allows creation when dto.assetType is within the caller scope', async () => {
      const dto = {
        itemDescription: 'Office Chair',
        assetClass: AssetClass.SEP,
        assetType: AssetType.FIXED,
        condition: AssetCondition.SERVICEABLE,
      } as any;

      const created = makeAsset({
        assetType: AssetType.FIXED,
        status: AssetStatus.REGISTERED,
      });
      mockAssetRepo.create.mockReturnValue(created);
      mockAssetRepo.save.mockResolvedValue(created);

      await expect(
        service.create(dto, 'pc-1', UserRole.PROPERTY_CUSTODIAN, '127.0.0.1', [
          AssetType.FIXED,
          AssetType.SUPPLIES,
        ]),
      ).resolves.toMatchObject({ status: AssetStatus.REGISTERED });
    });
  });

  // ── Section 12.1 — State machine valid transitions ────────────────────────
  describe('updateLifecycle() — valid transitions', () => {
    const validPairs: [AssetStatus, AssetStatus][] = [
      [AssetStatus.REGISTERED, AssetStatus.AVAILABLE],
      [AssetStatus.AVAILABLE, AssetStatus.ISSUED],
      [AssetStatus.AVAILABLE, AssetStatus.TRANSFERRED],
      [AssetStatus.AVAILABLE, AssetStatus.UNDER_REPAIR],
      [AssetStatus.AVAILABLE, AssetStatus.FLAGGED_FOR_DISPOSAL],
      [AssetStatus.ISSUED, AssetStatus.RETURNED],
      [AssetStatus.ISSUED, AssetStatus.UNDER_REPAIR],
      [AssetStatus.RETURNED, AssetStatus.AVAILABLE],
      [AssetStatus.TRANSFERRED, AssetStatus.AVAILABLE],
      [AssetStatus.UNDER_REPAIR, AssetStatus.AVAILABLE],
      [AssetStatus.FLAGGED_FOR_DISPOSAL, AssetStatus.DISPOSED],
    ];

    test.each(validPairs)('%s → %s should succeed', async (from, to) => {
      const asset = makeAsset({ status: from });
      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockAssetRepo.save.mockResolvedValue({ ...asset, status: to });
      const tx = { id: 'tx-1' };
      mockTxRepo.create.mockReturnValue(tx);
      mockTxRepo.save.mockResolvedValue(tx);

      const result = await service.updateLifecycle(
        asset.id,
        { status: to },
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(result.status).toBe(to);
      // Section 12.3 — audit log generated on every transition
      expect(mockAuditService.log).toHaveBeenCalledTimes(1);
    });

    it('resolves employeeId to UUID when status is ISSUED', async () => {
      const asset = {
        id: 'asset-1',
        status: AssetStatus.AVAILABLE,
        custodianId: null,
      } as AssetEntity;
      const recipient = { id: 'user-uuid-123', employeeId: 'CICC-0042' } as any;

      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockAssetRepo.save.mockResolvedValue({
        ...asset,
        status: AssetStatus.ISSUED,
        custodianId: 'user-uuid-123',
      });
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});
      mockUsersService.findByEmployeeId.mockResolvedValue(recipient);

      await service.updateLifecycle(
        'asset-1',
        { status: AssetStatus.ISSUED, employeeId: 'CICC-0042' },
        'performer-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(mockUsersService.findByEmployeeId).toHaveBeenCalledWith(
        'CICC-0042',
      );
      expect(mockAssetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ custodianId: 'user-uuid-123' }),
      );
    });

    it('records expectedReturnDate on the saved asset when ISSUED with a return date', async () => {
      const asset = makeAsset({ status: AssetStatus.AVAILABLE });
      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockAssetRepo.save.mockImplementation((a: AssetEntity) =>
        Promise.resolve(a),
      );
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      await service.updateLifecycle(
        asset.id,
        { status: AssetStatus.ISSUED, expectedReturnDate: '2026-12-31' },
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(mockAssetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedReturnDate: new Date('2026-12-31'),
        }),
      );
    });

    it('leaves expectedReturnDate null when ISSUED without a return date', async () => {
      const asset = makeAsset({
        status: AssetStatus.AVAILABLE,
        expectedReturnDate: new Date('2020-01-01'),
      });
      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockAssetRepo.save.mockImplementation((a: AssetEntity) =>
        Promise.resolve(a),
      );
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      await service.updateLifecycle(
        asset.id,
        { status: AssetStatus.ISSUED },
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(asset.expectedReturnDate).toBeNull();
    });

    it('re-arms overdueNotifiedAt on every fresh ISSUED, not only after RETURNED', async () => {
      // Path that never passes through RETURNED: an overdue asset (stamp set)
      // goes ISSUED → UNDER_REPAIR → AVAILABLE, then is re-issued. Without the
      // re-arm it would stay excluded from checkOverdueReturns() forever.
      const asset = makeAsset({
        status: AssetStatus.AVAILABLE,
        overdueNotifiedAt: new Date('2020-06-01'),
      });
      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockAssetRepo.save.mockImplementation((a: AssetEntity) =>
        Promise.resolve(a),
      );
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      await service.updateLifecycle(
        asset.id,
        { status: AssetStatus.ISSUED, expectedReturnDate: '2026-12-31' },
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(mockAssetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ overdueNotifiedAt: null }),
      );
      expect(asset.overdueNotifiedAt).toBeNull();
    });

    it('throws BadRequestException when employeeId is not found', async () => {
      const asset = {
        id: 'asset-1',
        status: AssetStatus.AVAILABLE,
      } as AssetEntity;
      mockAssetRepo.findOne.mockResolvedValue(asset);
      mockUsersService.findByEmployeeId.mockResolvedValue(null);

      await expect(
        service.updateLifecycle(
          'asset-1',
          { status: AssetStatus.ISSUED, employeeId: 'CICC-XXXX' },
          'performer-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException before any mutation when the asset is outside the caller scope', async () => {
      const asset = makeAsset({
        id: 'asset-1',
        assetType: AssetType.ICT,
        status: AssetStatus.AVAILABLE,
      });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(
        service.updateLifecycle(
          'asset-1',
          { status: AssetStatus.ISSUED },
          'pc-1',
          UserRole.PROPERTY_CUSTODIAN,
          '127.0.0.1',
          [AssetType.FIXED, AssetType.SUPPLIES],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockAssetRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Section 12.1 — State machine invalid transitions ──────────────────────
  describe('updateLifecycle() — invalid transitions', () => {
    const invalidPairs: [AssetStatus, AssetStatus][] = [
      [AssetStatus.ISSUED, AssetStatus.REGISTERED], // Can't go back to registered
      [AssetStatus.DISPOSED, AssetStatus.AVAILABLE], // Terminal state
      [AssetStatus.DISPOSED, AssetStatus.ISSUED], // Terminal state
      [AssetStatus.AVAILABLE, AssetStatus.RETURNED], // Must be issued first
      [AssetStatus.AVAILABLE, 'invalid_status' as AssetStatus], // Completely unknown status
    ];

    test.each(invalidPairs)('%s → %s should throw 400', async (from, to) => {
      const asset = makeAsset({ status: from });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(
        service.updateLifecycle(
          asset.id,
          { status: to },
          'user-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      // No audit log for invalid transitions
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  // ── Business rule: asset must be available before it can be issued ─────────
  it('throws 400 if issuing a non-available asset', async () => {
    const asset = makeAsset({ status: AssetStatus.UNDER_REPAIR });
    mockAssetRepo.findOne.mockResolvedValue(asset);

    await expect(
      service.updateLifecycle(
        asset.id,
        { status: AssetStatus.ISSUED },
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Section 12.3 — Audit log on every state change ───────────────────────
  it('always creates exactly one audit log entry per lifecycle change', async () => {
    const asset = makeAsset({ status: AssetStatus.AVAILABLE });
    mockAssetRepo.findOne.mockResolvedValue(asset);
    mockAssetRepo.save.mockResolvedValue({
      ...asset,
      status: AssetStatus.ISSUED,
    });
    mockTxRepo.create.mockReturnValue({});
    mockTxRepo.save.mockResolvedValue({});

    await service.updateLifecycle(
      asset.id,
      { status: AssetStatus.ISSUED },
      'user-1',
      UserRole.IT_PERSONNEL,
      '127.0.0.1',
    );

    expect(mockAuditService.log).toHaveBeenCalledTimes(1);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ASSET_ISSUED,
        affectedRecordId: asset.id,
        affectedRecordType: 'asset',
        metadata: expect.objectContaining({
          fromStatus: AssetStatus.AVAILABLE,
          toStatus: AssetStatus.ISSUED,
        }),
      }),
    );
  });

  // ── findOne throws NotFoundException for unknown ID ───────────────────────
  it('throws NotFoundException for unknown asset ID', async () => {
    mockAssetRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── findOne() — scope enforcement (Fix 1) ─────────────────────────────────
  describe('findOne() — scope enforcement', () => {
    it('throws ForbiddenException when the asset type is outside the caller scope', async () => {
      const asset = makeAsset({ assetType: AssetType.ICT });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(
        service.findOne(asset.id, [AssetType.FIXED, AssetType.SUPPLIES]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the asset when its type is within the caller scope', async () => {
      const asset = makeAsset({ assetType: AssetType.ICT });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(
        service.findOne(asset.id, [AssetType.ICT]),
      ).resolves.toMatchObject({ id: asset.id });
    });

    it('does not restrict access when no scope is provided (Admin/Management)', async () => {
      const asset = makeAsset({ assetType: AssetType.ICT });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(service.findOne(asset.id)).resolves.toMatchObject({
        id: asset.id,
      });
    });
  });

  // ── QR code generation ────────────────────────────────────────────────────
  it('generateQr() returns qrCode and barcodeValue and logs audit', async () => {
    const asset = makeAsset();
    mockAssetRepo.findOne.mockResolvedValue(asset);
    mockAssetRepo.update.mockResolvedValue(undefined);

    const result = await service.generateQr(
      asset.id,
      'user-1',
      UserRole.IT_PERSONNEL,
      '127.0.0.1',
    );

    expect(result.qrCode).toMatch(/^AIMRS-QR-/);
    expect(result.barcodeValue).toMatch(/^AIMRS-BC-/);
    expect(result.assetId).toBe(asset.id);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.QR_GENERATED }),
    );
  });

  it('generateQr() throws ForbiddenException when the asset is outside the caller scope', async () => {
    const asset = makeAsset({ assetType: AssetType.ICT });
    mockAssetRepo.findOne.mockResolvedValue(asset);

    await expect(
      service.generateQr(
        asset.id,
        'pc-1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
        [AssetType.FIXED, AssetType.SUPPLIES],
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockAssetRepo.update).not.toHaveBeenCalled();
  });

  // ── Section: update() ──────────────────────────────────────────────────────
  describe('update()', () => {
    it('updates editable fields and writes ASSET_UPDATED audit log', async () => {
      const asset = {
        id: 'asset-1',
        itemDescription: 'Old Laptop',
        brand: 'Dell',
        status: AssetStatus.AVAILABLE,
      } as AssetEntity;

      mockAssetRepo.findOne.mockResolvedValueOnce(asset).mockResolvedValueOnce({
        ...asset,
        itemDescription: 'New Laptop',
        brand: 'Lenovo',
      });
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const dto = { itemDescription: 'New Laptop', brand: 'Lenovo' };
      const result = await service.update(
        'asset-1',
        dto,
        'user-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith('asset-1', dto);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSET_UPDATED,
          affectedRecordId: 'asset-1',
          userId: 'user-1',
        }),
      );
      expect(result.itemDescription).toBe('New Laptop');
    });

    it('throws NotFoundException when asset does not exist', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          'missing-id',
          { brand: 'X' },
          'user-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the asset is outside the caller scope', async () => {
      const asset = makeAsset({ assetType: AssetType.ICT });
      mockAssetRepo.findOne.mockResolvedValue(asset);

      await expect(
        service.update(
          asset.id,
          { brand: 'X' },
          'pc-1',
          UserRole.PROPERTY_CUSTODIAN,
          '127.0.0.1',
          [AssetType.FIXED, AssetType.SUPPLIES],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });
  });

  // ── findAll() — paginated list with optional filters ──────────────────────
  describe('findAll()', () => {
    const makeQb = () => ({
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    it('returns paginated list with no filters applied', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAll();
      expect(qb.getManyAndCount).toHaveBeenCalled();
      expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
    });

    it('applies status filter when status param is provided', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, 20, undefined, 'available');
      expect(qb.andWhere).toHaveBeenCalledWith('a.status = :status', {
        status: 'available',
      });
    });

    it('applies search LIKE filter when search param is provided', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, 20, 'Dell');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({ q: '%Dell%' }),
      );
    });

    it('applies both status and search filters when both are provided', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, 20, 'Dell', 'issued');
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('applies assetType scope filter when assetTypeScope is provided', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, 20, undefined, undefined, [
        AssetType.FIXED,
        AssetType.SUPPLIES,
      ]);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.assetType IN (:...assetTypeScope)',
        {
          assetTypeScope: [AssetType.FIXED, AssetType.SUPPLIES],
        },
      );
    });

    it('does not add an assetType filter when assetTypeScope is undefined', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll();
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('assetType IN'),
        expect.anything(),
      );
    });

    it('narrows to the requested type when it is within the authorized scope', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        1,
        20,
        undefined,
        undefined,
        [AssetType.FIXED, AssetType.SUPPLIES],
        AssetType.FIXED,
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.assetType IN (:...assetTypeScope)',
        { assetTypeScope: [AssetType.FIXED] },
      );
    });

    it('rejects a requested type outside the authorized scope', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(
        service.findAll(
          1,
          20,
          undefined,
          undefined,
          [AssetType.FIXED, AssetType.SUPPLIES],
          AssetType.ICT,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a requested type that is not a real AssetType value', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(
        service.findAll(1, 20, undefined, undefined, undefined, 'not-a-type'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows an unscoped role (e.g. System Admin) to request any single real type', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        1,
        20,
        undefined,
        undefined,
        undefined,
        AssetType.SUPPLIES,
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.assetType IN (:...assetTypeScope)',
        { assetTypeScope: [AssetType.SUPPLIES] },
      );
    });
  });

  // ── findCatalogue() — available-only list ─────────────────────────────────
  describe('findCatalogue()', () => {
    it('returns only available assets with pagination', async () => {
      mockAssetRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findCatalogue();
      expect(mockAssetRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: AssetStatus.AVAILABLE } }),
      );
      expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
    });
  });

  // ── getStats() — inventory dashboard KPI counts ───────────────────────────
  describe('getStats()', () => {
    const makeStatsQb = (rawRows: Record<string, string>[]) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawRows),
    });

    it('returns counts broken down by status, class, and type', async () => {
      mockAssetRepo.createQueryBuilder
        .mockReturnValueOnce(
          makeStatsQb([{ status: AssetStatus.AVAILABLE, count: '10' }]),
        )
        .mockReturnValueOnce(makeStatsQb([{ assetClass: 'PPE', count: '7' }]))
        .mockReturnValueOnce(makeStatsQb([{ assetType: 'ICT', count: '10' }]));

      const result = await service.getStats();
      expect(result.total).toBe(10);
      expect(result.available).toBe(10);
      expect(result.issued).toBe(0); // ?? 0 fallback for missing keys
      expect(result.byClass).toEqual({ PPE: 7 });
      expect(result.byType).toEqual({ ICT: 10 });
    });

    it('returns all zeros and empty maps when no assets exist', async () => {
      mockAssetRepo.createQueryBuilder
        .mockReturnValueOnce(makeStatsQb([]))
        .mockReturnValueOnce(makeStatsQb([]))
        .mockReturnValueOnce(makeStatsQb([]));

      const result = await service.getStats();
      expect(result.total).toBe(0);
      expect(result.available).toBe(0);
      expect(result.byClass).toEqual({});
    });

    it('applies the assetType scope filter to all three grouped queries when provided', async () => {
      const statusQb = makeStatsQb([
        { status: AssetStatus.AVAILABLE, count: '3' },
      ]);
      const classQb = makeStatsQb([{ assetClass: 'SEP', count: '3' }]);
      const typeQb = makeStatsQb([{ assetType: 'Fixed', count: '3' }]);
      mockAssetRepo.createQueryBuilder
        .mockReturnValueOnce(statusQb)
        .mockReturnValueOnce(classQb)
        .mockReturnValueOnce(typeQb);

      const result = await service.getStats([
        AssetType.FIXED,
        AssetType.SUPPLIES,
      ]);

      const expectedCall = [
        'a.assetType IN (:...assetTypeScope)',
        { assetTypeScope: [AssetType.FIXED, AssetType.SUPPLIES] },
      ] as const;
      expect(statusQb.andWhere).toHaveBeenCalledWith(...expectedCall);
      expect(classQb.andWhere).toHaveBeenCalledWith(...expectedCall);
      expect(typeQb.andWhere).toHaveBeenCalledWith(...expectedCall);
      expect(result.total).toBe(3);
      expect(result.byType).toEqual({ Fixed: 3 });
    });
  });

  // ── updateLifecycle() — RETURNED re-arms the overdue-return watcher ────────
  describe('updateLifecycle() — RETURNED clears overdue tracking', () => {
    it('clears expectedReturnDate and overdueNotifiedAt on return', async () => {
      const asset = {
        id: 'a1',
        assetType: AssetType.ICT,
        status: AssetStatus.ISSUED,
        custodianId: 'h1',
        expectedReturnDate: new Date('2020-01-01'),
        overdueNotifiedAt: new Date(),
      } as AssetEntity;
      jest.spyOn(service, 'findOne').mockResolvedValue(asset);
      mockAssetRepo.save.mockImplementation((a: AssetEntity) =>
        Promise.resolve(a),
      );
      mockTxRepo.create.mockReturnValue({});
      mockTxRepo.save.mockResolvedValue({});

      await service.updateLifecycle(
        'a1',
        { status: AssetStatus.RETURNED },
        'u1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

      expect(asset.expectedReturnDate).toBeNull();
      expect(asset.overdueNotifiedAt).toBeNull();
      expect(asset.custodianId).toBeNull();
    });
  });

  // ── checkOverdueReturns() — overdue-return watcher ────────────────────────
  describe('checkOverdueReturns()', () => {
    // Inspectable QueryBuilder mock — chain calls are real jest.fn()s so a test
    // can assert the dedup filter clause was actually applied. Relying only on
    // getMany → [] would let a dropped `overdueNotifiedAt IS NULL` clause pass
    // unnoticed (Task 3/4 query-filter-coverage lesson).
    const makeOverdueQb = (rows: AssetEntity[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });

    it('notifies the current holder + the owning custodian role, once each, then stamps', async () => {
      const overdue = {
        id: 'a1',
        itemDescription: 'Projector',
        propertyNumber: 'PROP-9',
        assetType: AssetType.ICT,
        status: AssetStatus.ISSUED,
        custodianId: 'holder1',
        expectedReturnDate: new Date('2020-01-01'),
        overdueNotifiedAt: null,
      } as AssetEntity;
      const qb = makeOverdueQb([overdue]);
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      mockUsersService.findByRole.mockResolvedValue([{ id: 'itp1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkOverdueReturns();

      expect(count).toBe(1);

      // ICT assets route to IT Personnel as the owning custodian role.
      expect(mockUsersService.findByRole).toHaveBeenCalledWith(
        UserRole.IT_PERSONNEL,
      );

      // Dedup query-filter must be present — without this clause the watcher
      // would re-notify an already-stamped asset on every sweep.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('overdueNotifiedAt IS NULL'),
      );

      const recipients = mockNotifService.notify.mock.calls
        .map((c) => c[0] as string)
        .sort();
      expect(recipients).toEqual(['holder1', 'itp1']);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        expect.any(String),
        NotificationAlertType.OVERDUE_RETURN,
        expect.any(String),
        expect.any(String),
        'a1',
        'asset',
      );
      expect(mockAssetRepo.update).toHaveBeenCalledWith('a1', {
        overdueNotifiedAt: expect.any(Date),
      });
    });

    it('routes Fixed/Supplies assets to property_custodian', async () => {
      const overdue = {
        id: 'a2',
        itemDescription: 'Office Chair',
        assetType: AssetType.FIXED,
        status: AssetStatus.ISSUED,
        custodianId: 'h2',
        expectedReturnDate: new Date('2020-01-01'),
        overdueNotifiedAt: null,
      } as AssetEntity;
      mockAssetRepo.createQueryBuilder.mockReturnValue(
        makeOverdueQb([overdue]),
      );
      mockUsersService.findByRole.mockResolvedValue([{ id: 'pc1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.checkOverdueReturns();

      expect(mockUsersService.findByRole).toHaveBeenCalledWith(
        UserRole.PROPERTY_CUSTODIAN,
      );
      expect(mockUsersService.findByRole).not.toHaveBeenCalledWith(
        UserRole.IT_PERSONNEL,
      );
      const recipients = mockNotifService.notify.mock.calls
        .map((c) => c[0] as string)
        .sort();
      expect(recipients).toEqual(['h2', 'pc1']);
    });

    it('dedups a user who is both the holder and in the owning custodian role', async () => {
      const overdue = {
        id: 'a3',
        itemDescription: 'Laptop',
        assetType: AssetType.ICT,
        status: AssetStatus.ISSUED,
        custodianId: 'itp1',
        expectedReturnDate: new Date('2020-01-01'),
        overdueNotifiedAt: null,
      } as AssetEntity;
      mockAssetRepo.createQueryBuilder.mockReturnValue(
        makeOverdueQb([overdue]),
      );
      mockUsersService.findByRole.mockResolvedValue([{ id: 'itp1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.checkOverdueReturns();

      expect(mockNotifService.notify).toHaveBeenCalledTimes(1);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        'itp1',
        NotificationAlertType.OVERDUE_RETURN,
        expect.any(String),
        expect.any(String),
        'a3',
        'asset',
      );
    });

    it('null-guards a missing custodian — notifies only the custodian role', async () => {
      const overdue = {
        id: 'a4',
        itemDescription: 'Monitor',
        assetType: AssetType.ICT,
        status: AssetStatus.ISSUED,
        custodianId: null,
        expectedReturnDate: new Date('2020-01-01'),
        overdueNotifiedAt: null,
      } as AssetEntity;
      mockAssetRepo.createQueryBuilder.mockReturnValue(
        makeOverdueQb([overdue]),
      );
      mockUsersService.findByRole.mockResolvedValue([{ id: 'itp1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkOverdueReturns();

      expect(count).toBe(1);
      const recipients = mockNotifService.notify.mock.calls.map(
        (c) => c[0] as string,
      );
      expect(recipients).toEqual(['itp1']);
    });

    it('returns 0 and notifies nobody when nothing is overdue', async () => {
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeOverdueQb([]));

      await expect(service.checkOverdueReturns()).resolves.toBe(0);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });
  });

  // ── checkLowStock() — low-stock watcher + shared alert helper ─────────────
  describe('checkLowStock()', () => {
    // Inspectable QueryBuilder — same pattern as makeOverdueQb above. A test
    // that only stubs getMany → [] would let a dropped
    // `lowStockNotifiedAt IS NULL` clause pass unnoticed, so the row-returned
    // path asserts the dedup predicate was actually applied.
    const makeLowStockQb = (rows: AssetEntity[]) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });

    it('notifies property_custodian + system_admin once for an IES asset at/below its reorder level, then stamps', async () => {
      const low = {
        id: 's1',
        itemDescription: 'Toner',
        assetClass: AssetClass.IES,
        quantity: 3,
        reorderLevel: 5,
        lowStockNotifiedAt: null,
      } as AssetEntity;
      const qb = makeLowStockQb([low]);
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      mockUsersService.findByRole.mockImplementation((r: UserRole) =>
        Promise.resolve(
          r === UserRole.PROPERTY_CUSTODIAN
            ? [{ id: 'pc1' }]
            : r === UserRole.SYSTEM_ADMIN
              ? [{ id: 'ad1' }]
              : [],
        ),
      );
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkLowStock();

      expect(count).toBe(1);

      // Dedup query-filter must be present — mutation check: deleting the
      // `.andWhere('a.lowStockNotifiedAt IS NULL')` clause fails here.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('lowStockNotifiedAt IS NULL'),
      );

      const recipients = mockNotifService.notify.mock.calls
        .map((c) => c[0] as string)
        .sort();
      expect(recipients).toEqual(['ad1', 'pc1']);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        expect.any(String),
        NotificationAlertType.LOW_STOCK,
        'Low Stock',
        expect.stringContaining('Toner'),
        's1',
        'asset',
      );
      expect(mockAssetRepo.update).toHaveBeenCalledWith('s1', {
        lowStockNotifiedAt: expect.any(Date),
      });
    });

    it('falls back to DEFAULT_REORDER_LEVEL in the message and dedups a dual-role recipient', async () => {
      const low = {
        id: 's5',
        itemDescription: 'A4 Paper',
        assetClass: AssetClass.IES,
        quantity: 1,
        reorderLevel: null,
        lowStockNotifiedAt: null,
      } as AssetEntity;
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeLowStockQb([low]));
      // Same user id returned for both roles → Set-dedup to a single notify.
      mockUsersService.findByRole.mockResolvedValue([{ id: 'dual1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.checkLowStock();

      expect(count).toBe(1);
      expect(mockNotifService.notify).toHaveBeenCalledTimes(1);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        'dual1',
        NotificationAlertType.LOW_STOCK,
        'Low Stock',
        expect.stringContaining('reorder level 10'),
        's5',
        'asset',
      );
    });

    it('returns 0 and notifies nobody when the query yields no rows (already-stamped assets are filtered out)', async () => {
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeLowStockQb([]));

      await expect(service.checkLowStock()).resolves.toBe(0);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });
  });

  // ── notifyLowStockIfBelowThreshold() — single-asset entry point ──────────
  describe('notifyLowStockIfBelowThreshold()', () => {
    it('returns false and alerts nobody when the asset is not found', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.notifyLowStockIfBelowThreshold('missing'),
      ).resolves.toBe(false);
      expect(mockNotifService.notify).not.toHaveBeenCalled();
    });

    it('returns false for a non-IES asset even when its quantity is low', async () => {
      mockAssetRepo.findOne.mockResolvedValue({
        id: 'p1',
        assetClass: AssetClass.PPE,
        quantity: 0,
        reorderLevel: 5,
        lowStockNotifiedAt: null,
      });

      await expect(service.notifyLowStockIfBelowThreshold('p1')).resolves.toBe(
        false,
      );
      expect(mockNotifService.notify).not.toHaveBeenCalled();
    });

    it('returns false when the asset was already stamped', async () => {
      mockAssetRepo.findOne.mockResolvedValue({
        id: 's2',
        assetClass: AssetClass.IES,
        quantity: 1,
        reorderLevel: 5,
        lowStockNotifiedAt: new Date('2026-01-01'),
      });

      await expect(service.notifyLowStockIfBelowThreshold('s2')).resolves.toBe(
        false,
      );
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });

    it('returns false when quantity is still above the threshold', async () => {
      mockAssetRepo.findOne.mockResolvedValue({
        id: 's3',
        assetClass: AssetClass.IES,
        quantity: 50,
        reorderLevel: 5,
        lowStockNotifiedAt: null,
      });

      await expect(service.notifyLowStockIfBelowThreshold('s3')).resolves.toBe(
        false,
      );
      expect(mockNotifService.notify).not.toHaveBeenCalled();
    });

    it('takes the no-per-item-reorder-level fallback from SystemConfig, not the hardcoded constant', async () => {
      // reorderLevel is null, so the threshold is the system default. Config
      // now says 3; quantity 5 > 3 → NOT low. If the service still read the
      // hardcoded DEFAULT_REORDER_LEVEL (10), 5 <= 10 → it would alert.
      mockSystemConfig.getDefaultReorderLevel.mockReturnValue(3);
      mockAssetRepo.findOne.mockResolvedValue({
        id: 's7',
        assetClass: AssetClass.IES,
        quantity: 5,
        reorderLevel: null,
        lowStockNotifiedAt: null,
      });
      // Stub the alert fan-out so a wrong "still low" verdict yields a clean
      // `true` (alert sent) instead of an incidental crash.
      mockUsersService.findByRole.mockResolvedValue([{ id: 'pc1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.notifyLowStockIfBelowThreshold('s7')).resolves.toBe(
        false,
      );
      expect(mockSystemConfig.getDefaultReorderLevel).toHaveBeenCalled();
      expect(mockNotifService.notify).not.toHaveBeenCalled();
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });

    it('returns true, fans the alert out to custodians + admins, and stamps when below threshold', async () => {
      mockAssetRepo.findOne.mockResolvedValue({
        id: 's4',
        itemDescription: 'Ballpen',
        assetClass: AssetClass.IES,
        quantity: 2,
        reorderLevel: 5,
        lowStockNotifiedAt: null,
      });
      mockUsersService.findByRole.mockImplementation((r: UserRole) =>
        Promise.resolve(
          r === UserRole.PROPERTY_CUSTODIAN
            ? [{ id: 'pc1' }]
            : r === UserRole.SYSTEM_ADMIN
              ? [{ id: 'ad1' }]
              : [],
        ),
      );
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.notifyLowStockIfBelowThreshold('s4')).resolves.toBe(
        true,
      );

      const recipients = mockNotifService.notify.mock.calls
        .map((c) => c[0] as string)
        .sort();
      expect(recipients).toEqual(['ad1', 'pc1']);
      expect(mockNotifService.notify).toHaveBeenCalledWith(
        expect.any(String),
        NotificationAlertType.LOW_STOCK,
        'Low Stock',
        expect.stringContaining('Ballpen'),
        's4',
        'asset',
      );
      expect(mockAssetRepo.update).toHaveBeenCalledWith('s4', {
        lowStockNotifiedAt: expect.any(Date),
      });
    });

    it('fires at exactly the threshold (quantity === reorderLevel)', async () => {
      mockAssetRepo.findOne.mockResolvedValue({
        id: 's6',
        itemDescription: 'Folder',
        assetClass: AssetClass.IES,
        quantity: 5,
        reorderLevel: 5,
        lowStockNotifiedAt: null,
      });
      mockUsersService.findByRole.mockResolvedValue([{ id: 'pc1' }]);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await expect(service.notifyLowStockIfBelowThreshold('s6')).resolves.toBe(
        true,
      );
      expect(mockNotifService.notify).toHaveBeenCalledTimes(1);
    });
  });

  // ── update() — low-stock dedup-stamp re-arm on PATCH restock ─────────────
  describe('update() — low-stock re-arm', () => {
    it('clears lowStockNotifiedAt when a PATCH raises quantity above the reorder level', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 20,
        reorderLevel: 5,
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { quantity: 20 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ quantity: 20, lowStockNotifiedAt: null }),
      );
    });

    it('clears lowStockNotifiedAt on a reorderLevel-only PATCH that drops the threshold below the current quantity', async () => {
      // qty 5 / reorder 10 → currently low and stamped. Lowering reorder to 3
      // (no quantity in the PATCH) makes 5 > 3 → the line is no longer low, so
      // the stamp MUST be re-armed. The old `patch.quantity !== undefined`
      // gate skipped this path and left the row stuck out of checkLowStock().
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 5,
        reorderLevel: 10,
        lowStockNotifiedAt: new Date(),
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { reorderLevel: 3 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ reorderLevel: 3, lowStockNotifiedAt: null }),
      );
    });

    it('does NOT re-arm on a reorderLevel-only PATCH that stays at/above the current quantity', async () => {
      // qty 5 / reorder 10 → still low after raising reorder to 12 (5 <= 12),
      // so the stamp stays put.
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 5,
        reorderLevel: 10,
        lowStockNotifiedAt: new Date(),
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { reorderLevel: 12 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith('s1', {
        reorderLevel: 12,
      });
      expect(mockAssetRepo.update).not.toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ lowStockNotifiedAt: null }),
      );
    });

    it('judges a raised-both PATCH against the new threshold (stamp stays — quantity still below it)', async () => {
      // Stored threshold is 5; the PATCH raises it to 10 while setting
      // quantity 8. 8 clears the OLD threshold but not the NEW one, so the
      // dedup stamp must NOT be re-armed — the combined patch is judged
      // against patch.reorderLevel, not existing.reorderLevel.
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 8,
        reorderLevel: 5,
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { quantity: 8, reorderLevel: 10 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith('s1', {
        quantity: 8,
        reorderLevel: 10,
      });
      expect(mockAssetRepo.update).not.toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ lowStockNotifiedAt: null }),
      );
    });

    it('clears the stamp on a raised-both PATCH when quantity clears the NEW threshold', async () => {
      // Stored threshold is 5; the PATCH raises it to 10 and sets quantity 15.
      // 15 > the NEW threshold 10, so the stamp IS re-armed — proves the check
      // uses patch.reorderLevel, not just existing.reorderLevel (existing.5
      // alone would also clear it, so the discriminating value is that 15 also
      // exceeds the raised 10).
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 15,
        reorderLevel: 5,
        lowStockNotifiedAt: new Date(),
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { quantity: 15, reorderLevel: 10 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          quantity: 15,
          reorderLevel: 10,
          lowStockNotifiedAt: null,
        }),
      );
    });

    it('does NOT clear lowStockNotifiedAt when quantity stays at/below the reorder level', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 5,
        reorderLevel: 5,
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { quantity: 5 },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith('s1', { quantity: 5 });
      expect(mockAssetRepo.update).not.toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ lowStockNotifiedAt: null }),
      );
    });

    it('leaves the persisted patch equal to the DTO when the PATCH does not touch quantity', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 's1',
        assetClass: AssetClass.IES,
        quantity: 2,
        reorderLevel: 5,
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        's1',
        { brand: 'Acme' },
        'u1',
        UserRole.PROPERTY_CUSTODIAN,
        '127.0.0.1',
      );

      expect(mockAssetRepo.update).toHaveBeenCalledWith('s1', {
        brand: 'Acme',
      });
    });
  });
});
