import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Not } from 'typeorm';
import { ReportsService } from './reports.service';
import { GeneratedReportEntity } from './entities/generated-report.entity';
import { GeneratedFormEntity } from './entities/generated-form.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetRequestEntity } from '../asset-requests/entities/asset-request.entity';
import { AssetRepairEntity } from '../assets/entities/asset-repair.entity';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../system-config/system-config.service';
import PDFDocument from 'pdfkit';
import {
  AuditAction,
  UserRole,
  AssetStatus,
  AssetClass,
  AssetCondition,
  AssetType,
  OfficialFormType,
  RequisitionStatus,
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

  // A form and its number are stored in one transaction; the manager hands the
  // same repository back so assertions on mockFormRepo still see the save.
  const mockEntityManager = {
    query: jest.fn(),
    getRepository: jest.fn(),
  };

  const mockFormRepo = {
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
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
    find: jest.fn(),
  };

  const mockAssetRequestRepo = {
    findOne: jest.fn(),
  };

  const mockRepairRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
  };

  const mockSystemConfig = {
    getEntityName: jest.fn(() => 'CICC TEST ENTITY'),
    getFundCluster: jest.fn(() => ''),
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
        {
          provide: getRepositoryToken(AssetRequestEntity),
          useValue: mockAssetRequestRepo,
        },
        {
          provide: getRepositoryToken(AssetRepairEntity),
          useValue: mockRepairRepo,
        },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SystemConfigService, useValue: mockSystemConfig },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    mockEntityManager.getRepository.mockReturnValue(mockFormRepo);
    mockEntityManager.query.mockResolvedValue([{ last_value: 7 }]);
    mockFormRepo.manager.transaction.mockImplementation(
      (run: (em: typeof mockEntityManager) => Promise<unknown>) =>
        run(mockEntityManager),
    );
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

    // The archive used to show "asset 3fa85f64…" and no author: a custodian
    // could not tell which of fifty PARs was for which laptop.
    it('labels each form with its asset, requisition and author', async () => {
      mockFormRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'f-1',
            formType: OfficialFormType.PAR,
            documentNumber: 'PAR-2026-0007',
            generatedById: 'u-1',
            relatedAssetId: 'a-1',
            relatedRequisitionId: 'r-1',
            relatedAssetRequestId: null,
            filePath: 'stored',
            generatedAt: new Date('2026-10-15T08:00:00Z'),
          },
          {
            id: 'f-2',
            formType: OfficialFormType.RPCI,
            documentNumber: null,
            generatedById: 'u-gone',
            relatedAssetId: null,
            relatedRequisitionId: null,
            relatedAssetRequestId: null,
            filePath: 'stored',
            generatedAt: new Date('2026-10-14T08:00:00Z'),
          },
        ],
        2,
      ]);
      mockAssetRepo.find.mockResolvedValue([
        {
          id: 'a-1',
          itemDescription: 'Dell Latitude',
          propertyNumber: 'P-001',
        },
      ]);
      mockReqRepo.find.mockResolvedValue([
        { id: 'r-1', requestNumber: 'REQ-0031' },
      ]);
      mockUserRepo.find.mockResolvedValue([
        { id: 'u-1', firstName: 'Ian', lastName: 'Cruz' },
      ]);

      const { data } = await service.findAllForms();

      expect(data[0]).toMatchObject({
        id: 'f-1',
        documentNumber: 'PAR-2026-0007',
        assetLabel: 'Dell Latitude (P-001)',
        requisitionNumber: 'REQ-0031',
        generatedByName: 'Ian Cruz',
      });
      expect(data[1]).toMatchObject({
        assetLabel: null,
        requisitionNumber: null,
        generatedByName: null,
      });
    });

    it('does not look anything up for an empty page', async () => {
      mockFormRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllForms();

      expect(mockAssetRepo.find).not.toHaveBeenCalled();
      expect(mockUserRepo.find).not.toHaveBeenCalled();
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

    // clearAllMocks() keeps queued mockReturnValueOnce values, so a test that
    // queues more query builders than the code consumes would leak them into
    // the next test. These tests depend on the exact order, so start clean.
    beforeEach(() => {
      mockReqRepo.createQueryBuilder.mockReset();
      mockAssetRepo.createQueryBuilder.mockReset();
    });

    it('computes KPIs correctly when data exists', async () => {
      mockAssetRepo.count.mockResolvedValue(10);
      mockReqRepo.count.mockResolvedValue(5);
      // completeAssets QB
      mockAssetRepo.createQueryBuilder.mockReturnValue(makeQb(8));
      // decidedRows QB -> withinSla QB -> pendingPastSla QB -> fulfilledThisMonth QB
      mockReqRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(0, [{ hours: '2.5' }, { hours: '1.5' }]))
        .mockReturnValueOnce(makeQb(2))
        .mockReturnValueOnce(makeQb(0))
        .mockReturnValueOnce(makeQb(3));

      const result = await service.getKpi();
      expect(result.totalAssets).toBe(10);
      expect(result.recordCompleteness).toBe(80); // 8/10 * 100
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
        .mockReturnValueOnce(makeQb(0))
        .mockReturnValueOnce(makeQb(0));

      const result = await service.getKpi();
      expect(result.recordCompleteness).toBe(100);
      expect(result.avgApprovalHours).toBe(0);
      expect(result.slaComplianceRate).toBe(100);
    });

    // SLA compliance only looked at requisitions that had ALREADY been decided,
    // so the ones that blew through the 24-hour deadline and were still waiting
    // never counted: the dashboard read "SLA compliance 100%" right beside "4
    // requisitions past the 24-hour approval SLA".
    describe('SLA compliance counts requisitions still waiting past their deadline', () => {
      const run = async (
        decided: number,
        onTime: number,
        stillLate: number,
      ) => {
        mockAssetRepo.count.mockResolvedValue(0);
        mockReqRepo.count.mockResolvedValue(0);
        mockAssetRepo.createQueryBuilder.mockReturnValue(makeQb(0));
        const pendingQb = makeQb(stillLate);
        mockReqRepo.createQueryBuilder
          .mockReturnValueOnce(
            makeQb(
              0,
              Array.from({ length: decided }, () => ({ hours: '1' })),
            ),
          )
          .mockReturnValueOnce(makeQb(onTime))
          .mockReturnValueOnce(pendingQb)
          .mockReturnValueOnce(makeQb(0));
        return { result: await service.getKpi(), pendingQb };
      };

      it('a requisition still waiting past its deadline is a breach, not invisible', async () => {
        // 2 decided in time, 1 still waiting past its deadline -> 2 of 3.
        const { result } = await run(2, 2, 1);
        expect(result.slaComplianceRate).toBe(67);
      });

      it('four stalled requisitions drag a perfect record down (the dashboard case)', async () => {
        // 1 decided in time, 4 stalled -> 1 of 5, not "100%".
        const { result } = await run(1, 1, 4);
        expect(result.slaComplianceRate).toBe(20);
      });

      it('a decision made after the deadline is a breach too (unchanged)', async () => {
        const { result } = await run(2, 1, 0);
        expect(result.slaComplianceRate).toBe(50);
      });

      it('only counts requisitions awaiting the supervisor whose deadline has passed', async () => {
        const { pendingQb } = await run(0, 0, 0);
        expect(pendingQb.where).toHaveBeenCalledWith('r.status = :pending', {
          pending: RequisitionStatus.PENDING_SUPERVISOR,
        });
        expect(pendingQb.andWhere).toHaveBeenCalledWith(
          'r.slaDeadline < :now',
          { now: expect.any(Date) as Date },
        );
      });
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

    // The audit trail names every user and every record; the role matrix
    // (CLAUDE.md 4) gives it to the System Administrator and Management only.
    it.each([UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN])(
      'refuses the Audit Trail Report to %s',
      async (role) => {
        await expect(
          service.generate('AUDIT_TRAIL', 'PDF', 'u-1', role, '127.0.0.1'),
        ).rejects.toThrow(ForbiddenException);
        expect(mockReportRepo.save).not.toHaveBeenCalled();
      },
    );

    it.each([UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT])(
      'gives the Audit Trail Report to %s',
      async (role) => {
        const result = await service.generate(
          'AUDIT_TRAIL',
          'PDF',
          'u-1',
          role,
          '127.0.0.1',
        );
        expect(result.buffer).toEqual(Buffer.from('mock-pdf'));
      },
    );

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
      fetchReportData: (
        t: string,
        range?: { from?: string; to?: string },
      ) => Promise<ReportData>;
    };

    // Typed accessor avoids no-unsafe-call while still reaching the private method
    const fetch = (
      type: string,
      range?: { from?: string; to?: string },
    ): Promise<ReportData> =>
      (service as unknown as ServiceWithFetch).fetchReportData(type, range);

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

    it('PHYSICAL_COUNT counts what is still on the books, not disposed assets', async () => {
      mockAssetRepo.find.mockResolvedValue([makeAsset()]);

      const r = await fetch('PHYSICAL_COUNT');

      expect(r.title).toBe('Physical Count Summary');
      expect(r.rows).toHaveLength(1);
      // Disposed assets are off the books: the count sheet in the app leaves
      // them out, and the exported summary used to disagree with it.
      expect(mockAssetRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: Not(AssetStatus.DISPOSED) },
        }),
      );
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

    it('REPAIR_HISTORY lists each repair with service, outcome and turnaround', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            asset: makeAsset(),
            holder: { firstName: 'Ana', lastName: 'Cruz' },
            openedAt: new Date('2026-10-01T00:00:00Z'),
            serviceType: 'external',
            serviceProvider: 'Dell Service Center',
            reportedProblem: 'Does not charge',
            findings: 'Faulty DC jack',
            actionTaken: 'Replaced DC jack',
            outcome: 'repaired',
            completedAt: new Date('2026-10-05T00:00:00Z'),
          },
          {
            asset: makeAsset(),
            holder: null,
            openedAt: new Date('2026-10-08T00:00:00Z'),
            serviceType: 'in_house',
            serviceProvider: null,
            reportedProblem: null,
            findings: null,
            actionTaken: null,
            outcome: null,
            completedAt: null,
          },
        ]),
      };
      mockRepairRepo.createQueryBuilder.mockReturnValue(qb);

      const r = await fetch('REPAIR_HISTORY');

      expect(r.title).toBe('Repair History');
      expect(r.rows[0]).toEqual(
        expect.arrayContaining([
          'Ana Cruz',
          'External — Dell Service Center',
          'Does not charge / Faulty DC jack',
          'repaired',
          '4 d',
        ]),
      );
      expect(r.rows[1]).toEqual(
        expect.arrayContaining(['In stock', 'In-house', 'in progress', 'open']),
      );
    });

    it('rejects a report type it does not know instead of returning an asset list', async () => {
      await expect(fetch('UNKNOWN_REPORT_TYPE')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAssetRepo.find).not.toHaveBeenCalled();
    });

    describe('AUDIT_TRAIL', () => {
      const entry = (over: object = {}) => ({
        timestamp: new Date('2026-10-15T08:30:00Z'),
        userId: 'u-1',
        userRole: UserRole.IT_PERSONNEL,
        action: AuditAction.FORM_GENERATED,
        affectedRecordType: 'form',
        affectedRecordId: 'form-1',
        ipAddress: '10.0.0.5',
        ...over,
      });

      it('lists who did what, to which record, from where', async () => {
        mockAuditService.findAll.mockResolvedValue({
          data: [entry()],
          total: 1,
        });
        mockUserRepo.find.mockResolvedValue([
          {
            id: 'u-1',
            firstName: 'Ian',
            lastName: 'Cruz',
            employeeId: 'CICC-IT-001',
          },
        ]);

        const r = await fetch('AUDIT_TRAIL', {
          from: '2026-10-01',
          to: '2026-10-15',
        });

        expect(mockAuditService.findAll).toHaveBeenCalledWith(
          1,
          10_000,
          undefined,
          '2026-10-01',
          '2026-10-15',
        );
        expect(r.title).toBe('Audit Trail Report');
        expect(r.headers).toEqual([
          'Timestamp (UTC)',
          'User',
          'Role',
          'Action',
          'Record Type',
          'Record ID',
          'IP Address',
        ]);
        expect(r.rows[0]).toEqual([
          '2026-10-15 08:30:00',
          'Ian Cruz (CICC-IT-001)',
          UserRole.IT_PERSONNEL,
          AuditAction.FORM_GENERATED,
          'form',
          'form-1',
          '10.0.0.5',
        ]);
      });

      it('falls back to the account id when the account can no longer be found', async () => {
        mockAuditService.findAll.mockResolvedValue({
          data: [entry({ userId: 'u-gone' })],
          total: 1,
        });
        mockUserRepo.find.mockResolvedValue([]);

        const r = await fetch('AUDIT_TRAIL');

        expect(r.rows[0][1]).toBe('u-gone');
      });

      it('says so in the title when the export is capped', async () => {
        mockAuditService.findAll.mockResolvedValue({
          data: [entry()],
          total: 12_345,
        });
        mockUserRepo.find.mockResolvedValue([]);

        const r = await fetch('AUDIT_TRAIL');

        expect(r.title).toBe('Audit Trail Report (latest 1 of 12,345 entries)');
      });
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

  // ── Receipt of Returned Property — returnee resolution ───────────────────
  // After a completed return the asset has no custodian, so the returnee comes
  // from returneeId or the last completed Returns & Incidents return request.
  describe('generateFormRecord() — receipt returnee', () => {
    const employee = {
      id: 'emp-1',
      firstName: 'Ana',
      lastName: 'Reyes',
      employeeId: 'CICC-EMP-001',
      division: 'Operations',
      officeOrSection: 'Cybercrime Operations',
    };
    const issuer = {
      ...employee,
      id: 'it-1',
      firstName: 'Ian',
      lastName: 'Cruz',
    };

    beforeEach(() => {
      mockFormRepo.create.mockImplementation((x: object) => x);
      mockFormRepo.save.mockImplementation((x: object) =>
        Promise.resolve({ id: 'form-1', ...x }),
      );
      mockUserRepo.findOne.mockImplementation(
        ({ where: { id } }: { where: { id: string } }) =>
          Promise.resolve([employee, issuer].find((u) => u.id === id) ?? null),
      );
    });

    it('uses the explicit returneeId and links the stored form to the request', async () => {
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      const { form, buffer } = await service.generateFormRecord(
        {
          formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
          assetId: 'a-1',
          returneeId: 'emp-1',
          assetRequestId: 'ar-1',
        },
        'it-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
      expect(form).toMatchObject({
        id: 'form-1',
        relatedAssetRequestId: 'ar-1',
        formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
      });
      expect(mockAssetRequestRepo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to the requester of the last completed return when the asset has no custodian', async () => {
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      mockAssetRequestRepo.findOne.mockResolvedValue({
        requestedById: 'emp-1',
      });
      const { form } = await service.generateFormRecord(
        { formType: OfficialFormType.RECEIPT_RETURNED_SEP, assetId: 'a-1' },
        'it-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(form.relatedAssetRequestId).toBeNull();
      expect(mockAssetRequestRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assetId: 'a-1',
            type: 'return',
            status: 'completed',
          }),
        }),
      );
    });

    it('still uses the current custodian when there is one', async () => {
      mockAssetRepo.findOne.mockResolvedValue(
        makeAsset({ custodianId: 'emp-1' }),
      );
      await service.generateFormRecord(
        {
          formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
          assetId: 'a-1',
        },
        'it-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );
      expect(mockAssetRequestRepo.findOne).not.toHaveBeenCalled();
    });

    it('404s when no returnee can be determined', async () => {
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      mockAssetRequestRepo.findOne.mockResolvedValue(null);
      await expect(
        service.generateFormRecord(
          {
            formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
            assetId: 'a-1',
          },
          'it-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when the given returneeId does not exist', async () => {
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      await expect(
        service.generateFormRecord(
          {
            formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
            assetId: 'a-1',
            returneeId: 'nobody',
          },
          'it-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── document numbers ──────────────────────────────────────────────────────
  describe('generateFormRecord() — document numbers', () => {
    const year = new Date().getFullYear();
    const user = {
      id: 'emp-1',
      firstName: 'Juan',
      lastName: 'dela Cruz',
      employeeId: 'CICC-EMP-001',
      role: UserRole.EMPLOYEE,
      division: 'Operations',
      officeOrSection: 'Field',
    };

    beforeEach(() => {
      mockFormRepo.create.mockImplementation((x: object) => x);
      mockFormRepo.save.mockImplementation((x: object) =>
        Promise.resolve({ id: 'form-1', ...x }),
      );
      mockUserRepo.findOne.mockResolvedValue(user);
      mockAssetRepo.findOne.mockResolvedValue(
        makeAsset({ custodianId: 'emp-1' }),
      );
    });

    const generate = (formType: OfficialFormType, extra = {}) =>
      service.generateFormRecord(
        { formType, assetId: 'a-1', ...extra },
        'it-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

    it('stores the number it allocated with the form and prints it on the PDF', async () => {
      const text = jest.spyOn(PDFDocument.prototype, 'text');

      const { form } = await generate(OfficialFormType.PAR);

      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining('document_counters'),
        ['PAR', year],
      );
      expect(form.documentNumber).toBe(`PAR-${year}-0007`);
      expect(
        text.mock.calls.some(([t]) => String(t).includes(`PAR-${year}-0007`)),
      ).toBe(true);
      text.mockRestore();
    });

    it('allocates and saves inside one transaction', async () => {
      await generate(OfficialFormType.PTR, { targetOffice: 'Records' });

      expect(mockFormRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(
        GeneratedFormEntity,
      );
    });

    it('does not number a periodic report', async () => {
      mockAssetRepo.find.mockResolvedValue([]);

      const { form } = await generate(OfficialFormType.RPCI);

      expect(mockEntityManager.query).not.toHaveBeenCalled();
      expect(form.documentNumber).toBeNull();
    });

    it('a form that fails to generate takes no number and leaves no audit entry', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);

      await expect(generate(OfficialFormType.PAR)).rejects.toThrow(
        NotFoundException,
      );

      // The allocation was inside the transaction that threw, so it is rolled
      // back with it - the series keeps no hole.
      expect(mockFormRepo.save).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('audits the form once it is stored, with its number', async () => {
      await generate(OfficialFormType.PAR);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          affectedRecordId: 'form-1',
          metadata: expect.objectContaining({
            documentNumber: `PAR-${year}-0007`,
          }),
        }),
      );
    });
  });

  // ── returnee lookups and required inputs ──────────────────────────────────
  describe('generateFormRecord() — returnee lookup and required inputs', () => {
    const holder = {
      id: 'emp-1',
      firstName: 'Juan',
      lastName: 'dela Cruz',
      employeeId: 'CICC-0042',
      role: UserRole.EMPLOYEE,
      division: 'Operations',
      officeOrSection: 'Field',
    };
    const issuer = { ...holder, id: 'it-1', employeeId: 'CICC-IT-001' };

    beforeEach(() => {
      mockFormRepo.create.mockImplementation((x: object) => x);
      mockFormRepo.save.mockImplementation((x: object) =>
        Promise.resolve({ id: 'form-1', ...x }),
      );
      mockAssetRepo.findOne.mockResolvedValue(makeAsset({ custodianId: null }));
      mockAssetRequestRepo.findOne.mockResolvedValue(null);
      mockReqRepo.findOne.mockResolvedValue(null);
      mockUserRepo.findOne.mockImplementation(
        ({ where }: { where: { id?: string; employeeId?: string } }) =>
          Promise.resolve(
            [holder, issuer].find(
              (u) =>
                (where.id && u.id === where.id) ||
                (where.employeeId && u.employeeId === where.employeeId),
            ) ?? null,
          ),
      );
    });

    const receipt = (extra: object = {}) =>
      service.generateFormRecord(
        {
          formType: OfficialFormType.RECEIPT_RETURNED_PROPERTY,
          assetId: 'a-1',
          ...extra,
        },
        'it-1',
        UserRole.IT_PERSONNEL,
        '127.0.0.1',
      );

    // The page used to ask for a "Returnee User UUID" nobody can see anywhere.
    it('finds the returnee by employee ID', async () => {
      await receipt({ returneeEmployeeId: 'CICC-0042' });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'CICC-0042' },
      });
    });

    it('404s on an employee ID that belongs to nobody', async () => {
      await expect(
        receipt({ returneeEmployeeId: 'CICC-9999' }),
      ).rejects.toThrow(NotFoundException);
    });

    // A unit handed back through a replacement requisition has no return
    // request and no custodian, so its receipt used to 404 for want of a name.
    it('takes the holder from the replacement requisition that collected the unit', async () => {
      mockReqRepo.findOne.mockResolvedValue({ requestedById: 'emp-1' });

      const { form } = await receipt();

      expect(mockReqRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            replacedAssetId: 'a-1',
            status: RequisitionStatus.FULFILLED,
          }),
        }),
      );
      expect(form.formType).toBe(OfficialFormType.RECEIPT_RETURNED_PROPERTY);
    });

    it('asks for the receiving office on a Property Transfer Report', async () => {
      mockAssetRepo.findOne.mockResolvedValue(
        makeAsset({ custodianId: 'emp-1' }),
      );

      await expect(
        service.generateFormRecord(
          { formType: OfficialFormType.PTR, assetId: 'a-1' },
          'it-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── RSMI / RPCI content ───────────────────────────────────────────────────
  describe('generateFormRecord() — RSMI and RPCI content', () => {
    beforeEach(() => {
      mockFormRepo.create.mockImplementation((x: object) => x);
      mockFormRepo.save.mockImplementation((x: object) =>
        Promise.resolve({ id: 'form-1', ...x }),
      );
    });

    const drawn = async (run: () => Promise<unknown>) => {
      const text = jest.spyOn(PDFDocument.prototype, 'text');
      await run();
      const out = text.mock.calls.map(([t]) => String(t));
      text.mockRestore();
      return out;
    };

    it('RSMI lists only supplies, priced from the stock they were issued from', async () => {
      mockReqRepo.find.mockResolvedValue([
        {
          requestNumber: 'REQ-0031',
          items: [
            {
              assetClass: AssetClass.IES,
              assetType: AssetType.SUPPLIES,
              itemDescription: 'Bond Paper A4',
              quantity: 3,
              fulfilledAssetId: 'stock-1',
            },
            {
              assetClass: AssetClass.PPE,
              assetType: AssetType.ICT,
              itemDescription: 'Server Rack',
              quantity: 1,
              fulfilledAssetId: 'unit-9',
            },
            {
              assetClass: AssetClass.IES,
              assetType: AssetType.SUPPLIES,
              itemDescription: 'Ink Cartridge',
              quantity: 2,
              fulfilledAssetId: null,
            },
          ],
        },
      ]);
      // Postgres hands decimals back as strings.
      mockAssetRepo.find.mockResolvedValue([
        { id: 'stock-1', acquisitionCost: '250.00', itemCode: 'SUP-0001' },
      ]);

      const out = await drawn(() =>
        service.generateFormRecord(
          { formType: OfficialFormType.RSMI },
          'it-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      );

      expect(out).toContain('Bond Paper A4');
      expect(out).toContain('Ink Cartridge');
      expect(out).not.toContain('Server Rack');
      expect(out).toContain('SUP-0001');
      expect(out).toContain('TOTAL AMOUNT: PHP 750.00');
      expect(out).not.toContain('PHP 0.00');
    });

    it('RPCI carries the stock on record, with the physical count left to the counter', async () => {
      mockAssetRepo.find.mockResolvedValue([
        {
          itemDescription: 'Bond Paper A4',
          assetClass: AssetClass.IES,
          acquisitionCost: '250.00',
          condition: AssetCondition.SERVICEABLE,
          quantity: 48,
        },
      ]);

      const out = await drawn(() =>
        service.generateFormRecord(
          { formType: OfficialFormType.RPCI },
          'it-1',
          UserRole.IT_PERSONNEL,
          '127.0.0.1',
        ),
      );

      expect(out).toContain('48');
      expect(out).toContain('Serviceable');
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
