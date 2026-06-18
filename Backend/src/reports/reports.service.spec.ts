import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GeneratedReportEntity } from './entities/generated-report.entity';
import { GeneratedFormEntity } from './entities/generated-form.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  UserRole,
  AssetStatus,
  AssetClass,
  AssetCondition,
  AssetType,
  OfficialFormType,
} from '../../../packages/shared/src/enums';

const makeAsset = (overrides: Partial<AssetEntity> = {}): AssetEntity =>
  ({
    id: 'a-1',
    itemDescription: 'Test Laptop',
    propertyNumber: 'P-001',
    brand: 'Dell',
    serialNumber: 'SN-001',
    assetClass: AssetClass.PPE,
    assetType: AssetType.ICT,
    condition: AssetCondition.SERVICEABLE,
    status: AssetStatus.AVAILABLE,
    division: 'IT Division',
    officeOrSection: 'Network Ops',
    officeLocation: 'Main Building',
    acquisitionCost: 50000,
    acquisitionDate: new Date('2024-01-01'),
    custodianId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as AssetEntity;

describe('ReportsService', () => {
  let service: ReportsService;

  const mockReportRepo = {
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFormRepo = {
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAssetRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockReqRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(GeneratedReportEntity),
          useValue: mockReportRepo,
        },
        {
          provide: getRepositoryToken(GeneratedFormEntity),
          useValue: mockFormRepo,
        },
        { provide: getRepositoryToken(AssetEntity), useValue: mockAssetRepo },
        {
          provide: getRepositoryToken(RequisitionEntity),
          useValue: mockReqRepo,
        },
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
  });

  // ── findAll() ─────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('returns paginated generated report list', async () => {
      mockReportRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 50 });
    });
  });

  // ── findAllForms() ────────────────────────────────────────────────────────
  describe('findAllForms()', () => {
    it('returns paginated generated form list', async () => {
      mockFormRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAllForms();
      expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 50 });
    });
  });

  // ── getKpi() ──────────────────────────────────────────────────────────────
  describe('getKpi()', () => {
    const makeQb = (
      getCountResult = 0,
      getRawManyResult: Record<string, string>[] = [],
    ) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(getCountResult),
      getRawMany: jest.fn().mockResolvedValue(getRawManyResult),
    });

    it('computes KPIs correctly when data exists', async () => {
      mockAssetRepo.count.mockResolvedValue(10);
      mockReqRepo.count.mockResolvedValue(5);
      // completeAssets QB
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeQb(8));
      // decidedRows QB → withinSla QB → fulfilledThisMonth QB
      mockReqRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(0, [{ hours: '2.5' }, { hours: '1.5' }]))
        .mockReturnValueOnce(makeQb(2))
        .mockReturnValueOnce(makeQb(3));

      const result = await service.getKpi();
      expect(result.totalAssets).toBe(10);
      expect(result.inventoryAccuracy).toBe(80); // 8/10 * 100
      expect(result.avgApprovalHours).toBe(2); // (2.5+1.5)/2
      expect(result.slaComplianceRate).toBe(100); // 2/2 * 100
      expect(result.fulfilledThisMonth).toBe(3);
      expect(result.generatedAt).toBeDefined();
    });

    it('returns 100% defaults and zero avg when no data exists', async () => {
      mockAssetRepo.count.mockResolvedValue(0);
      mockReqRepo.count.mockResolvedValue(0);
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeQb(0));
      mockReqRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(0, []))
        .mockReturnValueOnce(makeQb(0))
        .mockReturnValueOnce(makeQb(0));

      const result = await service.getKpi();
      expect(result.inventoryAccuracy).toBe(100);
      expect(result.avgApprovalHours).toBe(0);
      expect(result.slaComplianceRate).toBe(100);
    });
  });

  // ── generate() ────────────────────────────────────────────────────────────
  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(service as any, 'buildPdfReport')
        .mockResolvedValue(Buffer.from('mock-pdf'));
      jest
        .spyOn(service as any, 'buildExcelReport')
        .mockResolvedValue(Buffer.from('mock-xlsx'));
      mockReportRepo.create.mockReturnValue({
        id: 'r-1',
        reportType: 'ASSET_MASTER_LIST',
      });
      mockReportRepo.save.mockResolvedValue({
        id: 'r-1',
        reportType: 'ASSET_MASTER_LIST',
      });
    });

    it('builds PDF, saves report record, and logs audit', async () => {
      const result = await service.generate(
        'ASSET_MASTER_LIST',
        'PDF',
        'u-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(result.buffer).toEqual(Buffer.from('mock-pdf'));
      expect(mockReportRepo.save).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REPORT_GENERATED }),
      );
    });

    it('builds Excel and stores xlsx extension in filePath', async () => {
      const result = await service.generate(
        'ASSET_MASTER_LIST',
        'Excel',
        'u-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(result.buffer).toEqual(Buffer.from('mock-xlsx'));
      expect(mockReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'Excel' }),
      );
    });
  });

  // ── generate() — real builders (covers buildPdfReport / buildExcelReport) ──
  // These tests do NOT spy on the private builders so the actual PDF/Excel
  // generation code executes and counts toward coverage.
  describe('generate() — real builders', () => {
    beforeEach(() => {
      // One asset row is enough to drive the PDF/Excel table-rendering paths.
      mockAssetRepo.find.mockResolvedValue([makeAsset()]);
      mockReportRepo.create.mockReturnValue({
        id: 'r-1',
        reportType: 'ASSET_MASTER_LIST',
      });
      mockReportRepo.save.mockResolvedValue({
        id: 'r-1',
        reportType: 'ASSET_MASTER_LIST',
      });
    });

    it('runs real buildPdfReport and returns a non-empty Buffer', async () => {
      const result = await service.generate(
        'ASSET_MASTER_LIST',
        'PDF',
        'u-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(100);
    }, 15000);

    it('runs real buildExcelReport and returns a non-empty Buffer', async () => {
      const result = await service.generate(
        'ASSET_MASTER_LIST',
        'Excel',
        'u-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(100);
    }, 15000);

    it('PDF builder handles multi-page reports when row count exceeds page height', async () => {
      // 40+ rows guarantees the page-break branch inside buildPdfReport is hit
      mockAssetRepo.find.mockResolvedValue(
        Array.from({ length: 40 }, (_, i) =>
          makeAsset({ propertyNumber: `P-${String(i).padStart(3, '0')}` }),
        ),
      );
      const result = await service.generate(
        'ASSET_MASTER_LIST',
        'PDF',
        'u-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(result.buffer.length).toBeGreaterThan(100);
    }, 15000);
  });

  // ── fetchReportData() — private, tested via direct access ─────────────────
  describe('fetchReportData() — private', () => {
    type ReportData = {
      title: string;
      headers: string[];
      rows: (string | number | null)[][];
    };
    type ServiceWithFetch = {
      fetchReportData: (t: string) => Promise<ReportData>;
    };

    // Typed accessor avoids no-unsafe-call while still reaching the private method
    const fetch = (type: string): Promise<ReportData> =>
      (service as unknown as ServiceWithFetch).fetchReportData(type);

    const makeDisposalQb = (assets: AssetEntity[]) => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(assets),
    });

    it('ASSET_MASTER_LIST maps assets and handles null/non-null acquisitionCost', async () => {
      const nullCostAsset = makeAsset({
        acquisitionCost: null as any,
        acquisitionDate: null as any,
      });
      const fullAsset = makeAsset({
        acquisitionCost: 50000,
        acquisitionDate: new Date('2024-01-01'),
      });
      mockAssetRepo.find.mockResolvedValue([nullCostAsset, fullAsset]);

      const r = await fetch('ASSET_MASTER_LIST');

      expect(r.title).toBe('Asset Master List');
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0][9]).toBe('—'); // null cost → fallback
      expect(r.rows[1][9]).toContain('₱'); // non-null cost → formatted
      expect(r.rows[0][10]).toBe('—'); // null date → fallback
    });

    it('REQUISITION_HISTORY maps reqs and shows — for null fulfilledAt', async () => {
      mockReqRepo.find.mockResolvedValue([
        {
          requestNumber: 'REQ-001',
          requisitionType: 'SUPPLY',
          status: 'pending_supervisor',
          items: [{ itemDescription: 'Ballpen' }],
          submittedAt: new Date('2024-01-01'),
          requiredDate: new Date('2024-01-05'),
          fulfilledAt: null,
        },
      ]);

      const r = await fetch('REQUISITION_HISTORY');

      expect(r.title).toBe('Requisition History Log');
      expect(r.rows[0][2]).toBe('pending supervisor'); // replaceAll('_', ' ')
      expect(r.rows[0][3]).toBe('Ballpen'); // items joined
      expect(r.rows[0][6]).toBe('—'); // null fulfilledAt
    });

    it('ASSET_ISSUANCE returns issued asset rows', async () => {
      mockAssetRepo.find.mockResolvedValue([
        makeAsset({ status: AssetStatus.ISSUED }),
      ]);

      const r = await fetch('ASSET_ISSUANCE');

      expect(r.title).toBe('Asset Issuance Record');
      expect(r.rows).toHaveLength(1);
    });

    it('ASSET_RETURN returns returned asset rows with formatted condition', async () => {
      mockAssetRepo.find.mockResolvedValue([
        makeAsset({
          status: AssetStatus.RETURNED,
          condition: AssetCondition.SERVICEABLE,
        }),
      ]);

      const r = await fetch('ASSET_RETURN');

      expect(r.title).toBe('Asset Return Record');
      expect(r.rows[0][4]).toBe('serviceable');
    });

    it('PHYSICAL_COUNT returns all assets', async () => {
      mockAssetRepo.find.mockResolvedValue([makeAsset()]);

      const r = await fetch('PHYSICAL_COUNT');

      expect(r.title).toBe('Physical Count Summary');
      expect(r.rows).toHaveLength(1);
    });

    it('DISPOSAL uses createQueryBuilder and handles null/non-null cost', async () => {
      const nullCost = makeAsset({
        status: AssetStatus.FLAGGED_FOR_DISPOSAL,
        acquisitionCost: null as any,
      });
      const withCost = makeAsset({
        status: AssetStatus.DISPOSED,
        acquisitionCost: 25000,
      });
      mockAssetRepo.createQueryBuilder.mockReturnValue(
        makeDisposalQb([nullCost, withCost]),
      );

      const r = await fetch('DISPOSAL');

      expect(r.title).toBe('Disposal Documentation Report');
      expect(r.rows[0][7]).toBe('—'); // null cost
      expect(r.rows[1][7]).toContain('₱'); // formatted cost
    });

    it('default case returns generic headers and uses replaceAll on title', async () => {
      mockAssetRepo.find.mockResolvedValue([makeAsset()]);

      const r = await fetch('UNKNOWN_REPORT_TYPE');

      expect(r.title).toBe('UNKNOWN REPORT TYPE');
      expect(r.headers).toEqual(['Property #', 'Description', 'Status']);
    });
  });

  // ── generateForm() — error-path coverage ──────────────────────────────────
  // Happy-path tests would require mocking all 18 form generators; these error
  // paths cover the helper functions (getAsset, getCustodian, getIssuer) and the
  // default unsupported-type branch without needing generator mocks.
  describe('generateForm() — error paths', () => {
    it('throws NotFoundException when assetId is missing for PAR', async () => {
      await expect(
        service.generateForm(
          { formType: OfficialFormType.PAR },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset record is not found', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);
      await expect(
        service.generateForm(
          { formType: OfficialFormType.PAR, assetId: 'a-missing' },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset has no custodian assigned', async () => {
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      await expect(
        service.generateForm(
          { formType: OfficialFormType.PAR, assetId: 'a-1' },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when custodian user record is not found', async () => {
      mockAssetRepo.findOne.mockResolvedValue(
        makeAsset({ custodianId: 'u-missing' }),
      );
      mockUserRepo.findOne.mockResolvedValue(null); // getCustodian → getUser returns null
      await expect(
        service.generateForm(
          { formType: OfficialFormType.PAR, assetId: 'a-1' },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when requisitionId is missing for RIS', async () => {
      await expect(
        service.generateForm(
          { formType: OfficialFormType.RIS },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for unsupported form type', async () => {
      await expect(
        service.generateForm(
          { formType: 'UNSUPPORTED_TYPE' as OfficialFormType },
          'u-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── downloadForm() ────────────────────────────────────────────────────────
  describe('downloadForm()', () => {
    const makeFormQb = (returnValue: object | null) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(returnValue),
    });

    it('returns form and buffer when found with pdfContent', async () => {
      const pdfContent = Buffer.from('pdf-data');
      mockFormRepo.createQueryBuilder.mockReturnValue(
        makeFormQb({ id: 'f-1', pdfContent }),
      );

      const result = await service.downloadForm('f-1');

      expect(result.buffer).toEqual(pdfContent);
      expect(result.form).toMatchObject({ id: 'f-1' });
    });

    it('throws NotFoundException when form record does not exist', async () => {
      mockFormRepo.createQueryBuilder.mockReturnValue(makeFormQb(null));

      await expect(service.downloadForm('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when form has no stored pdfContent', async () => {
      mockFormRepo.createQueryBuilder.mockReturnValue(
        makeFormQb({ id: 'f-1', pdfContent: null }),
      );

      await expect(service.downloadForm('f-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
