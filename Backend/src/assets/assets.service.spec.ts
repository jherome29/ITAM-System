import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import {
  AssetStatus,
  AssetClass,
  AssetType,
  AssetCondition,
  UserRole,
  AuditAction,
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
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();
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
      mockAssetRepo.save.mockResolvedValue({ ...asset, status: AssetStatus.ISSUED, custodianId: 'user-uuid-123' });
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

      expect(mockUsersService.findByEmployeeId).toHaveBeenCalledWith('CICC-0042');
      expect(mockAssetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ custodianId: 'user-uuid-123' }),
      );
    });

    it('throws BadRequestException when employeeId is not found', async () => {
      const asset = { id: 'asset-1', status: AssetStatus.AVAILABLE } as AssetEntity;
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
      } as AssetEntity);
      mockAssetRepo.update.mockResolvedValue({ affected: 1 });

      const dto = { itemDescription: 'New Laptop', brand: 'Lenovo' };
      const result = await service.update('asset-1', dto, 'user-1', UserRole.IT_PERSONNEL, '127.0.0.1');

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
        service.update('missing-id', { brand: 'X' }, 'user-1', UserRole.IT_PERSONNEL, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
