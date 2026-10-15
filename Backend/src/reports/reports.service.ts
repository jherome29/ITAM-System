import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { GeneratedReportEntity } from './entities/generated-report.entity';
import { GeneratedFormEntity } from './entities/generated-form.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { withFormIdentity } from './forms/base-form.generator';
import { DOCUMENT_SERIES, allocateDocumentNumber } from './document-numbers';
import {
  OfficialFormType,
  AuditAction,
  UserRole,
  AssetClass,
  AssetStatus,
  AssetRequestStatus,
  AssetRequestType,
  RepairServiceType,
  RequisitionStatus,
} from '../../../packages/shared/src/enums';

// Form generators
import { generatePAR } from './forms/par.generator';
import { generateICS } from './forms/ics.generator';
import { generatePTR } from './forms/ptr.generator';
import { generateIIRUP } from './forms/iirup.generator';
import { generateRLSSDDP } from './forms/rlsddp.generator';
import { generateStickerCard } from './forms/sticker-card.generator';
import { generateReceiptReturnedProperty } from './forms/receipt-returned-property.generator';
import { generateReceiptReturnedSEP } from './forms/receipt-returned-sep.generator';
import { generateIAR } from './forms/iar.generator';
import { generateMoveIn } from './forms/move-in.generator';
import { generateMoveOut } from './forms/move-out.generator';
import { generateRIS } from './forms/ris.generator';
import { generateRSMI } from './forms/rsmi.generator';
import { generateRSPI } from './forms/rspi.generator';
import { generateRPCI } from './forms/rpci.generator';
import { generateRPCPPE } from './forms/rpcppe.generator';
import { generateWMR } from './forms/wmr.generator';
import { generateAnnexA4 } from './forms/annex-a4.generator';
import { AssetRequestEntity } from '../asset-requests/entities/asset-request.entity';
import { AssetRepairEntity } from '../assets/entities/asset-repair.entity';

// SVC: Improve — PDF management reports and COA official form generation

export interface GenerateFormInput {
  formType: OfficialFormType;
  assetId?: string;
  requisitionId?: string;
  targetOffice?: string;
  circumstances?: string;
  lossType?: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  purpose?: string;
  requestingDivision?: string;
  returneeId?: string;
  /** CICC employee ID (e.g. CICC-0042) - what a custodian can actually see. */
  returneeEmployeeId?: string;
  receiverId?: string;
  dateFrom?: string;
  dateTo?: string;
  // Internal only (not on the HTTP DTO): links the stored form to the
  // Returns & Incidents request that produced it.
  assetRequestId?: string;
}

/** Optional period for the reports that take one (YYYY-MM-DD, end inclusive). */
export interface ReportRange {
  from?: string;
  to?: string;
}

/** An audit export is held in memory and drawn row by row, so it is bounded. */
const AUDIT_REPORT_ROW_LIMIT = 10_000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(GeneratedReportEntity)
    private readonly reportRepo: Repository<GeneratedReportEntity>,
    @InjectRepository(GeneratedFormEntity)
    private readonly formRepo: Repository<GeneratedFormEntity>,
    @InjectRepository(AssetEntity)
    private readonly assetRepo: Repository<AssetEntity>,
    @InjectRepository(RequisitionEntity)
    private readonly reqRepo: Repository<RequisitionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AssetRequestEntity)
    private readonly assetRequestRepo: Repository<AssetRequestEntity>,
    @InjectRepository(AssetRepairEntity)
    private readonly repairRepo: Repository<AssetRepairEntity>,
    private readonly auditService: AuditService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async findAll(page = 1, limit = 50) {
    const [data, total] = await this.reportRepo.findAndCount({
      order: { generatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findAllForms(page = 1, limit = 50) {
    const [forms, total] = await this.formRepo.findAndCount({
      order: { generatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Names for the ids, so the archive can say which laptop and whose slip
    // instead of "asset 3fa85f64…". One lookup per kind for the whole page.
    const ids = (pick: (f: GeneratedFormEntity) => string | null) => [
      ...new Set(forms.map(pick).filter((id): id is string => id !== null)),
    ];
    const assetIds = ids((f) => f.relatedAssetId);
    const requisitionIds = ids((f) => f.relatedRequisitionId);
    const userIds = ids((f) => f.generatedById);
    const [assets, requisitions, users] = await Promise.all([
      assetIds.length
        ? this.assetRepo.find({ where: { id: In(assetIds) } })
        : [],
      requisitionIds.length
        ? this.reqRepo.find({ where: { id: In(requisitionIds) } })
        : [],
      userIds.length ? this.userRepo.find({ where: { id: In(userIds) } }) : [],
    ]);
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const requisitionById = new Map(requisitions.map((r) => [r.id, r]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const data = forms.map((f) => {
      const asset = f.relatedAssetId ? assetById.get(f.relatedAssetId) : null;
      const author = userById.get(f.generatedById);
      return {
        ...f,
        assetLabel: asset
          ? `${asset.itemDescription}${asset.propertyNumber ? ` (${asset.propertyNumber})` : ''}`
          : null,
        requisitionNumber: f.relatedRequisitionId
          ? (requisitionById.get(f.relatedRequisitionId)?.requestNumber ?? null)
          : null,
        generatedByName: author
          ? `${author.firstName} ${author.lastName}`
          : null,
      };
    });
    return { data, total, page, limit };
  }

  /**
   * getKpi — Management dashboard KPIs.
   * SVC: Improve — executive-level inventory and process metrics.
   *
   * `recordCompleteness` is the share of assets that have both a property
   * number and a serial number. It is a data-quality measure, NOT inventory
   * accuracy: accuracy means agreement with a physical count, which the system
   * does not record (it used to be exposed as `inventoryAccuracy`, which read
   * as one).
   */
  async getKpi() {
    const totalAssets = await this.assetRepo.count();
    const completeAssets = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.propertyNumber IS NOT NULL')
      .andWhere('a.serialNumber IS NOT NULL')
      .getCount();
    const recordCompleteness =
      totalAssets > 0 ? Math.round((completeAssets / totalAssets) * 100) : 100;

    const decidedRows = await this.reqRepo
      .createQueryBuilder('r')
      .select(
        'EXTRACT(EPOCH FROM (r.supervisorDecidedAt - r.submittedAt)) / 3600',
        'hours',
      )
      .where('r.supervisorDecidedAt IS NOT NULL')
      .andWhere('r.submittedAt IS NOT NULL')
      .getRawMany<{ hours: string }>();

    const avgApprovalHours =
      decidedRows.length > 0
        ? Math.round(
            (decidedRows.reduce((s, r) => s + Number.parseFloat(r.hours), 0) /
              decidedRows.length) *
              10,
          ) / 10
        : 0;

    const withinSla = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.supervisorDecidedAt IS NOT NULL')
      .andWhere('r.slaDeadline IS NOT NULL')
      .andWhere('r.supervisorDecidedAt <= r.slaDeadline')
      .getCount();
    // A requisition still waiting past its deadline is a breach already. Only
    // counting the decided ones left the stalled ones invisible, so the
    // dashboard read "SLA compliance 100%" beside "4 requisitions past SLA".
    // Requisitions still inside their window are not assessable yet and stay out.
    const pendingPastSla = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.status = :pending', {
        pending: RequisitionStatus.PENDING_SUPERVISOR,
      })
      .andWhere('r.slaDeadline < :now', { now: new Date() })
      .getCount();
    const assessed = decidedRows.length + pendingPastSla;
    const slaComplianceRate =
      assessed > 0 ? Math.round((withinSla / assessed) * 100) : 100;

    const totalRequisitions = await this.reqRepo.count();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const fulfilledThisMonth = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'fulfilled' })
      .andWhere('r.fulfilledAt >= :start', { start: startOfMonth })
      .getCount();

    return {
      recordCompleteness,
      avgApprovalHours,
      slaComplianceRate,
      totalAssets,
      totalRequisitions,
      fulfilledThisMonth,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * generate — Builds a management report as a PDF or Excel buffer and persists metadata.
   * SVC: Improve — management reporting and COA audit readiness.
   * Returns `{ buffer, report }` so the controller can stream the binary directly.
   */
  async generate(
    reportType: string,
    format: 'PDF' | 'Excel',
    generatedById: string,
    userRole: UserRole,
    ipAddress: string,
    range: ReportRange = {},
  ): Promise<{ buffer: Buffer; report: GeneratedReportEntity }> {
    // Role matrix (CLAUDE.md 4): the audit trail is for the System Administrator
    // and Management. The endpoint is open to IT and the property custodian for
    // the other reports, so this one is checked here.
    if (
      reportType === 'AUDIT_TRAIL' &&
      userRole !== UserRole.SYSTEM_ADMIN &&
      userRole !== UserRole.MANAGEMENT
    ) {
      throw new ForbiddenException(
        'The audit trail report is limited to the System Administrator and Management',
      );
    }

    const buffer =
      format === 'PDF'
        ? await this.buildPdfReport(reportType, range)
        : await this.buildExcelReport(reportType, range);

    const ext = format === 'PDF' ? 'pdf' : 'xlsx';
    const report = this.reportRepo.create({
      reportType,
      format,
      filePath: `generated/reports/${reportType}_${Date.now()}.${ext}`,
      generatedById,
    });
    const saved = await this.reportRepo.save(report);

    await this.auditService.log({
      userId: generatedById,
      userRole,
      action: AuditAction.REPORT_GENERATED,
      affectedRecordId: saved.id,
      affectedRecordType: 'report',
      ipAddress,
      metadata: { reportType, format },
    });

    return { buffer, report: saved };
  }

  // ── PDF report builder ─────────────────────────────────────────────────────
  private async buildPdfReport(
    reportType: string,
    range: ReportRange,
  ): Promise<Buffer> {
    const { rows, headers, title } = await this.fetchReportData(
      reportType,
      range,
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'LETTER',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header bar
      doc.rect(40, 40, doc.page.width - 80, 36).fill('#1a4d7a');
      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('AIMRS — ' + title, 50, 52, { width: doc.page.width - 100 });
      doc
        .fillColor('#555')
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Generated: ${new Date().toLocaleString('en-PH')}  |  ${this.systemConfig.getEntityName()}`,
          50,
          85,
        );

      // Column layout
      const colCount = headers.length;
      const colW = Math.floor((doc.page.width - 80) / colCount);
      let y = 100;

      // Table header row
      doc.rect(40, y, doc.page.width - 80, 18).fill('#e8f0f7');
      headers.forEach((h, i) => {
        doc
          .fillColor('#1a4d7a')
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(String(h), 44 + i * colW, y + 5, {
            width: colW - 4,
            ellipsis: true,
          });
      });
      y += 18;

      // Data rows
      rows.forEach((row, ri) => {
        if (y > doc.page.height - 60) {
          doc.addPage({ layout: 'landscape', size: 'LETTER', margin: 40 });
          y = 40;
        }
        if (ri % 2 === 0) {
          doc.rect(40, y, doc.page.width - 80, 16).fill('#f8fafc');
        }
        row.forEach((cell, i) => {
          doc
            .fillColor('#333')
            .font('Helvetica')
            .fontSize(7)
            .text(String(cell ?? '—'), 44 + i * colW, y + 4, {
              width: colW - 4,
              ellipsis: true,
            });
        });
        y += 16;
      });

      // Footer
      doc
        .fillColor('#aaa')
        .font('Helvetica')
        .fontSize(7)
        .text(`Total records: ${rows.length}`, 40, doc.page.height - 30);

      doc.end();
    });
  }

  // ── Excel report builder ───────────────────────────────────────────────────
  private async buildExcelReport(
    reportType: string,
    range: ReportRange,
  ): Promise<Buffer> {
    const { rows, headers, title } = await this.fetchReportData(
      reportType,
      range,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIMRS — CICC';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(title.slice(0, 31));

    // Title row
    sheet.mergeCells(1, 1, 1, headers.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `AIMRS — ${title}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF1A4D7A' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0F7' },
    };

    // Generated date row
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.getCell(2, 1).value =
      `Generated: ${new Date().toLocaleString('en-PH')} | ${this.systemConfig.getEntityName()}`;
    sheet.getCell(2, 1).font = {
      italic: true,
      size: 9,
      color: { argb: 'FF555555' },
    };

    // Header row
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A4D7A' },
      };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0C4D8' } } };
    });

    // Data rows
    rows.forEach((row, ri) => {
      const r = sheet.addRow(row);
      if (ri % 2 === 0) {
        r.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    });

    // Auto-width columns
    sheet.columns.forEach((col) => {
      let max = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = (cell.text ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 40);
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ── Data fetcher — returns typed rows for a given report type ─────────────
  private async fetchReportData(
    reportType: string,
    range: ReportRange = {},
  ): Promise<{
    headers: string[];
    rows: (string | number | null)[][];
    title: string;
  }> {
    switch (reportType) {
      case 'ASSET_MASTER_LIST': {
        const assets = await this.assetRepo.find({
          order: { createdAt: 'DESC' },
        });
        return {
          title: 'Asset Master List',
          headers: [
            'Property #',
            'Description',
            'Brand',
            'Serial #',
            'Class',
            'Type',
            'Condition',
            'Status',
            'Division / Section',
            'Acquisition Cost',
            'Acquired',
          ],
          rows: assets.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.brand ?? '—',
            a.serialNumber ?? '—',
            a.assetClass,
            a.assetType,
            (a.condition ?? '—').replaceAll('_', ' '),
            a.status.replaceAll('_', ' '),
            `${a.division ?? '—'} / ${a.officeOrSection ?? '—'}`,
            a.acquisitionCost == null
              ? '—'
              : `₱${Number(a.acquisitionCost).toLocaleString('en-PH')}`,
            a.acquisitionDate
              ? new Date(a.acquisitionDate).toLocaleDateString('en-PH')
              : '—',
          ]),
        };
      }

      case 'REQUISITION_HISTORY': {
        const reqs = await this.reqRepo.find({
          relations: { items: true },
          order: { createdAt: 'DESC' },
        });
        return {
          title: 'Requisition History Log',
          headers: [
            'Request #',
            'Type',
            'Status',
            'Items',
            'Submitted',
            'Required Date',
            'Fulfilled At',
          ],
          rows: reqs.map((r) => [
            r.requestNumber,
            r.requisitionType,
            r.status.replaceAll('_', ' '),
            r.items.map((i) => i.itemDescription).join('; '),
            new Date(r.submittedAt).toLocaleDateString('en-PH'),
            new Date(r.requiredDate).toLocaleDateString('en-PH'),
            r.fulfilledAt
              ? new Date(r.fulfilledAt).toLocaleDateString('en-PH')
              : '—',
          ]),
        };
      }

      case 'ASSET_ISSUANCE': {
        const issued = await this.assetRepo.find({
          where: { status: AssetStatus.ISSUED },
          order: { updatedAt: 'DESC' },
        });
        return {
          title: 'Asset Issuance Record',
          headers: [
            'Property #',
            'Description',
            'Brand',
            'Serial #',
            'Division / Section',
            'Location',
          ],
          rows: issued.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.brand ?? '—',
            a.serialNumber ?? '—',
            `${a.division ?? '—'} / ${a.officeOrSection ?? '—'}`,
            a.officeLocation ?? '—',
          ]),
        };
      }

      case 'ASSET_RETURN': {
        const returned = await this.assetRepo.find({
          where: { status: AssetStatus.RETURNED },
          order: { updatedAt: 'DESC' },
        });
        return {
          title: 'Asset Return Record',
          headers: [
            'Property #',
            'Description',
            'Brand',
            'Serial #',
            'Condition',
            'Division / Section',
          ],
          rows: returned.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.brand ?? '—',
            a.serialNumber ?? '—',
            (a.condition ?? '—').replaceAll('_', ' '),
            `${a.division ?? '—'} / ${a.officeOrSection ?? '—'}`,
          ]),
        };
      }

      case 'PHYSICAL_COUNT': {
        // What is still on the books: disposed assets are gone, and the count
        // sheet in the app already leaves them out.
        const assets = await this.assetRepo.find({
          where: { status: Not(AssetStatus.DISPOSED) },
          order: { condition: 'ASC' },
        });
        return {
          title: 'Physical Count Summary',
          headers: [
            'Property #',
            'Description',
            'Class',
            'Type',
            'Condition',
            'Status',
            'Location',
          ],
          rows: assets.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.assetClass,
            a.assetType,
            (a.condition ?? '—').replaceAll('_', ' '),
            a.status.replaceAll('_', ' '),
            a.officeLocation ?? '—',
          ]),
        };
      }

      // SVC: Improve — repair history: turnaround, outcomes, repeat repairs.
      case 'REPAIR_HISTORY': {
        const repairs = await this.repairRepo
          .createQueryBuilder('r')
          .leftJoinAndSelect('r.asset', 'asset')
          .leftJoinAndSelect('r.holder', 'holder')
          .orderBy('r.openedAt', 'DESC')
          .getMany();
        const day = (d: Date | string | null) =>
          d ? new Date(d).toISOString().slice(0, 10) : '—';
        const turnaround = (r: AssetRepairEntity) =>
          r.completedAt
            ? `${Math.max(0, Math.round((new Date(r.completedAt).getTime() - new Date(r.openedAt).getTime()) / 86_400_000))} d`
            : 'open';
        return {
          title: 'Repair History',
          headers: [
            'Property #',
            'Description',
            'Holder',
            'Opened',
            'Service',
            'Problem / Findings',
            'Action Taken',
            'Outcome',
            'Closed',
            'Turnaround',
          ],
          rows: repairs.map((r) => [
            r.asset?.propertyNumber ?? '—',
            r.asset?.itemDescription ?? '—',
            r.holder
              ? `${r.holder.firstName} ${r.holder.lastName}`
              : 'In stock',
            day(r.openedAt),
            r.serviceType === RepairServiceType.EXTERNAL
              ? `External${r.serviceProvider ? ` — ${r.serviceProvider}` : ''}`
              : 'In-house',
            [r.reportedProblem, r.findings].filter(Boolean).join(' / ') || '—',
            r.actionTaken ?? '—',
            (r.outcome ?? 'in progress').replaceAll('_', ' '),
            day(r.completedAt),
            turnaround(r),
          ]),
        };
      }

      case 'DISPOSAL': {
        const disposal = await this.assetRepo
          .createQueryBuilder('a')
          .where('a.status IN (:...statuses)', {
            statuses: [AssetStatus.FLAGGED_FOR_DISPOSAL, AssetStatus.DISPOSED],
          })
          .orderBy('a.updatedAt', 'DESC')
          .getMany();
        return {
          title: 'Disposal Documentation Report',
          headers: [
            'Property #',
            'Description',
            'Brand',
            'Serial #',
            'Class',
            'Condition',
            'Status',
            'Acquisition Cost',
          ],
          rows: disposal.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.brand ?? '—',
            a.serialNumber ?? '—',
            a.assetClass,
            (a.condition ?? '—').replaceAll('_', ' '),
            a.status.replaceAll('_', ' '),
            a.acquisitionCost == null
              ? '—'
              : `₱${Number(a.acquisitionCost).toLocaleString('en-PH')}`,
          ]),
        };
      }

      // SVC: Improve - the audit trail as a document, for COA review.
      case 'AUDIT_TRAIL': {
        const { data: entries, total } = await this.auditService.findAll(
          1,
          AUDIT_REPORT_ROW_LIMIT,
          undefined,
          range.from,
          range.to,
        );
        const users = entries.length
          ? await this.userRepo.find({
              where: { id: In([...new Set(entries.map((e) => e.userId))]) },
            })
          : [];
        const byId = new Map(users.map((u) => [u.id, u]));
        const who = (id: string) => {
          const u = byId.get(id);
          return u ? `${u.firstName} ${u.lastName} (${u.employeeId})` : id;
        };
        return {
          title:
            total > entries.length
              ? `Audit Trail Report (latest ${entries.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} entries)`
              : 'Audit Trail Report',
          headers: [
            'Timestamp (UTC)',
            'User',
            'Role',
            'Action',
            'Record Type',
            'Record ID',
            'IP Address',
          ],
          rows: entries.map((e) => [
            e.timestamp.toISOString().slice(0, 19).replace('T', ' '),
            who(e.userId),
            e.userRole,
            e.action,
            e.affectedRecordType,
            e.affectedRecordId,
            e.ipAddress,
          ]),
        };
      }

      default:
        throw new BadRequestException(`Unknown report type: ${reportType}`);
    }
  }

  /**
   * generateForm — Generates a COA official form as a PDF Buffer.
   * SVC: Deliver and Support / Improve — asset issuance, requisition fulfillment, and management reporting.
   */
  async generateForm(
    input: GenerateFormInput,
    generatedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<Buffer> {
    const { buffer } = await this.generateFormRecord(
      input,
      generatedById,
      userRole,
      ipAddress,
    );
    return buffer;
  }

  /**
   * Same as generateForm() but also returns the stored record — used where the
   * caller must link to the saved form (Returns & Incidents documents).
   */
  async generateFormRecord(
    input: GenerateFormInput,
    generatedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<{ form: GeneratedFormEntity; buffer: Buffer }> {
    const series = DOCUMENT_SERIES[input.formType];
    const identity = {
      entityName: this.systemConfig.getEntityName(),
      fundCluster: this.systemConfig.getFundCluster(),
    };

    // The number is taken and the form stored in one transaction: a form that
    // fails to generate (no custodian, unknown asset) hands its number back
    // instead of leaving a hole in the series.
    const saved = await this.formRepo.manager.transaction(async (em) => {
      const documentNumber = series
        ? await allocateDocumentNumber(em, series, new Date().getFullYear())
        : null;
      // The agency name, Fund Cluster and number in the header are read by the
      // generators from the request's context rather than fixed text.
      return withFormIdentity(
        { ...identity, documentNumber: documentNumber ?? undefined },
        () =>
          this.buildFormRecord(
            input,
            generatedById,
            documentNumber,
            em.getRepository(GeneratedFormEntity),
          ),
      );
    });

    // After the commit, so the trail never records a form that was rolled back.
    await this.auditService.log({
      userId: generatedById,
      userRole,
      action: AuditAction.FORM_GENERATED,
      affectedRecordId: saved.form.id,
      affectedRecordType: 'form',
      ipAddress,
      metadata: {
        formType: input.formType,
        documentNumber: saved.form.documentNumber ?? undefined,
        assetId: input.assetId,
        requisitionId: input.requisitionId,
        assetRequestId: input.assetRequestId,
      },
    });

    return saved;
  }

  private async buildFormRecord(
    input: GenerateFormInput,
    generatedById: string,
    documentNumber: string | null,
    formRepo: Repository<GeneratedFormEntity>,
  ): Promise<{ form: GeneratedFormEntity; buffer: Buffer }> {
    const { formType } = input;
    let buffer: Buffer;

    // ── Helper: load a single asset or throw ────────────────────────────────
    const getAsset = async (id?: string): Promise<AssetEntity> => {
      if (!id)
        throw new NotFoundException('assetId is required for this form type');
      const asset = await this.assetRepo.findOne({ where: { id } });
      if (!asset) throw new NotFoundException(`Asset ${id} not found`);
      return asset;
    };

    // ── Helper: load a user by ID ────────────────────────────────────────────
    const getUser = async (id?: string | null): Promise<UserEntity | null> => {
      if (!id) return null;
      return this.userRepo.findOne({ where: { id } });
    };

    // ── Helper: load the current custodian of an asset ───────────────────────
    const getCustodian = async (asset: AssetEntity): Promise<UserEntity> => {
      if (!asset.custodianId)
        throw new NotFoundException(
          `Asset ${asset.id} has no assigned custodian`,
        );
      const user = await getUser(asset.custodianId);
      if (!user)
        throw new NotFoundException(`Custodian ${asset.custodianId} not found`);
      return user;
    };

    // ── Helper: who returned the asset ──────────────────────────────────────
    // A completed return clears the custodian, so by the time the receipt is
    // generated there is none. Fall back to the requester of the most recent
    // completed return request (Returns & Incidents) for that asset.
    const getReturnee = async (asset: AssetEntity): Promise<UserEntity> => {
      if (input.returneeId) {
        const u = await getUser(input.returneeId);
        if (!u)
          throw new NotFoundException(`User ${input.returneeId} not found`);
        return u;
      }
      if (input.returneeEmployeeId) {
        const u = await this.userRepo.findOne({
          where: { employeeId: input.returneeEmployeeId },
        });
        if (!u)
          throw new NotFoundException(
            `No employee with ID ${input.returneeEmployeeId}`,
          );
        return u;
      }
      if (asset.custodianId) return getCustodian(asset);
      const lastReturn = await this.assetRequestRepo.findOne({
        where: {
          assetId: asset.id,
          type: AssetRequestType.RETURN,
          status: AssetRequestStatus.COMPLETED,
        },
        order: { completedAt: 'DESC' },
      });
      // A unit collected by a replacement requisition never had a return
      // request: the holder is whoever asked for its replacement.
      const replacement = lastReturn
        ? null
        : await this.reqRepo.findOne({
            where: {
              replacedAssetId: asset.id,
              status: RequisitionStatus.FULFILLED,
            },
            order: { fulfilledAt: 'DESC' },
          });
      const holderId = lastReturn?.requestedById ?? replacement?.requestedById;
      const u = await getUser(holderId);
      if (!u) {
        throw new NotFoundException(
          `Asset ${asset.id} has no current custodian or completed return — enter the returnee's employee ID.`,
        );
      }
      return u;
    };

    // ── Helper: load the generating user ────────────────────────────────────
    const getIssuer = async (): Promise<UserEntity> => {
      const u = await getUser(generatedById);
      if (!u) throw new NotFoundException('Generating user not found');
      return u;
    };

    // ── Helper: date range ───────────────────────────────────────────────────
    const getDateRange = () => ({
      from: input.dateFrom
        ? new Date(input.dateFrom)
        : new Date(new Date().getFullYear(), 0, 1),
      to: input.dateTo ? new Date(input.dateTo) : new Date(),
    });

    switch (formType) {
      // ── Group A: Asset forms ───────────────────────────────────────────────

      case OfficialFormType.PAR: {
        const asset = await getAsset(input.assetId);
        const recipient = await getCustodian(asset);
        const issuer = await getIssuer();
        buffer = await generatePAR(asset, recipient, issuer);
        break;
      }

      case OfficialFormType.ICS: {
        const asset = await getAsset(input.assetId);
        const recipient = await getCustodian(asset);
        const issuer = await getIssuer();
        buffer = await generateICS(asset, recipient, issuer);
        break;
      }

      case OfficialFormType.PTR: {
        const asset = await getAsset(input.assetId);
        const releasingOfficer = await getIssuer();
        // A transfer report with no destination is not a report; the form used
        // to print the placeholder "Target Office/Section" instead.
        if (!input.targetOffice?.trim())
          throw new BadRequestException(
            'targetOffice is required for a Property Transfer Report',
          );
        buffer = await generatePTR(
          asset,
          releasingOfficer,
          input.targetOffice.trim(),
        );
        break;
      }

      case OfficialFormType.IIRUP: {
        const asset = await getAsset(input.assetId);
        const inspector = await getIssuer();
        buffer = await generateIIRUP(asset, inspector);
        break;
      }

      case OfficialFormType.RLSDDP: {
        const asset = await getAsset(input.assetId);
        const officer = await getIssuer();
        buffer = await generateRLSSDDP(
          asset,
          officer,
          input.lossType ?? 'Damaged',
          input.circumstances ?? '',
        );
        break;
      }

      case OfficialFormType.STICKER_CARD: {
        const asset = await getAsset(input.assetId);
        buffer = await generateStickerCard([asset]);
        break;
      }

      case OfficialFormType.RECEIPT_RETURNED_PROPERTY: {
        const asset = await getAsset(input.assetId);
        const returnee = await getReturnee(asset);
        const receiver = await getIssuer();
        buffer = await generateReceiptReturnedProperty(
          asset,
          returnee,
          receiver,
        );
        break;
      }

      case OfficialFormType.RECEIPT_RETURNED_SEP: {
        const asset = await getAsset(input.assetId);
        const returnee = await getReturnee(asset);
        const receiver = await getIssuer();
        buffer = await generateReceiptReturnedSEP(asset, returnee, receiver);
        break;
      }

      case OfficialFormType.IAR: {
        const asset = await getAsset(input.assetId);
        const inspector = await getIssuer();
        buffer = await generateIAR(asset, inspector);
        break;
      }

      case OfficialFormType.MOVE_IN: {
        const asset = await getAsset(input.assetId);
        const requester = await getIssuer();
        buffer = await generateMoveIn(
          asset,
          requester,
          input.requestingDivision ?? requester.division,
        );
        break;
      }

      case OfficialFormType.MOVE_OUT: {
        const asset = await getAsset(input.assetId);
        const requester = await getIssuer();
        buffer = await generateMoveOut(
          asset,
          requester,
          input.requestingDivision ?? requester.division,
          input.purpose ?? '',
        );
        break;
      }

      // ── Group B: Requisition form ──────────────────────────────────────────

      case OfficialFormType.RIS: {
        if (!input.requisitionId)
          throw new NotFoundException('requisitionId is required for RIS');
        const req = await this.reqRepo.findOne({
          where: { id: input.requisitionId },
          relations: { items: true },
        });
        if (!req)
          throw new NotFoundException(
            `Requisition ${input.requisitionId} not found`,
          );
        const requester = (await getUser(req.requestedById))!;
        const supervisor = await getUser(req.supervisorId);
        const issuer = await getIssuer();
        buffer = await generateRIS(req, requester, supervisor, issuer);
        break;
      }

      // ── Group C: Batch/Period forms ────────────────────────────────────────

      case OfficialFormType.RSMI: {
        const { from, to } = getDateRange();
        const reqs = await this.reqRepo.find({
          where: { fulfilledAt: Between(from, to) },
          relations: { items: true },
          order: { fulfilledAt: 'ASC' },
        });
        // Supplies only: the report is of supplies and materials, and a
        // laptop or a desk in the same requisition belongs on the PAR/ICS.
        const supplyLines = reqs.flatMap((r) =>
          r.items
            .filter((i) => i.assetClass === AssetClass.IES)
            .map((i) => ({ requestNumber: r.requestNumber, line: i })),
        );
        // Unit cost and stock number come from the stock the line was issued
        // from; a line fulfilled before stock was linked has neither.
        const stockIds = [
          ...new Set(
            supplyLines.flatMap(({ line }) =>
              line.fulfilledAssetId ? [line.fulfilledAssetId] : [],
            ),
          ),
        ];
        const stock = stockIds.length
          ? await this.assetRepo.find({ where: { id: In(stockIds) } })
          : [];
        const stockById = new Map(stock.map((a) => [a.id, a]));
        const items = supplyLines.map(({ requestNumber, line }) => {
          const unit = line.fulfilledAssetId
            ? stockById.get(line.fulfilledAssetId)
            : undefined;
          return {
            requestNumber,
            itemDescription: line.itemDescription,
            assetType: line.assetType,
            quantity: line.quantity,
            // Postgres returns decimals as strings.
            acquisitionCost: unit ? Number(unit.acquisitionCost) : null,
            stockNumber: unit?.itemCode || null,
          };
        });
        buffer = await generateRSMI(items, from, to);
        break;
      }

      case OfficialFormType.RSPI: {
        const { from, to } = getDateRange();
        const assets = await this.assetRepo.find({
          where: { assetClass: AssetClass.SEP, status: AssetStatus.ISSUED },
          order: { createdAt: 'ASC' },
        });
        const filtered = assets.filter((a) => {
          const d = a.createdAt ? new Date(a.createdAt) : null;
          return d && d >= from && d <= to;
        });
        buffer = await generateRSPI(filtered, from, to);
        break;
      }

      case OfficialFormType.RPCI: {
        const { to } = getDateRange();
        const assets = await this.assetRepo.find({
          where: [
            { assetClass: AssetClass.IES },
            { assetClass: AssetClass.SEP },
          ],
          order: { assetClass: 'ASC', itemDescription: 'ASC' },
        });
        buffer = await generateRPCI(assets, to);
        break;
      }

      case OfficialFormType.RPCPPE: {
        const { to } = getDateRange();
        const assets = await this.assetRepo.find({
          where: { assetClass: AssetClass.PPE },
          order: { propertyNumber: 'ASC' },
        });
        buffer = await generateRPCPPE(assets, to);
        break;
      }

      case OfficialFormType.WMR: {
        const { from, to } = getDateRange();
        const assets = await this.assetRepo.find({
          where: { status: AssetStatus.DISPOSED },
          order: { updatedAt: 'DESC' },
        });
        const filtered = assets.filter((a) => {
          const d = a.updatedAt ? new Date(a.updatedAt) : null;
          return d && d >= from && d <= to;
        });
        buffer = await generateWMR(filtered, from, to);
        break;
      }

      case OfficialFormType.ANNEX_A4: {
        const { from, to } = getDateRange();
        const assets = await this.assetRepo.find({
          where: { assetClass: AssetClass.SEP },
          order: { createdAt: 'ASC' },
        });
        const filtered = assets.filter((a) => {
          const d = a.createdAt ? new Date(a.createdAt) : null;
          return d && d >= from && d <= to;
        });
        const enriched = await Promise.all(
          filtered.map(async (a) => {
            const custodian = a.custodianId
              ? await getUser(a.custodianId)
              : null;
            return {
              ...a,
              custodianName: custodian
                ? `${custodian.firstName} ${custodian.lastName}`
                : undefined,
            };
          }),
        );
        buffer = await generateAnnexA4(enriched, from, to);
        break;
      }

      default:
        throw new NotFoundException(
          `Unsupported form type: ${formType as string}`,
        );
    }

    // ── Persist form record with PDF content ──────────────────────────────
    const form = formRepo.create({
      formType,
      documentNumber,
      relatedAssetId: input.assetId ?? null,
      relatedRequisitionId: input.requisitionId ?? null,
      relatedAssetRequestId: input.assetRequestId ?? null,
      filePath: 'stored',
      generatedById,
      pdfContent: buffer,
    });
    const saved = await formRepo.save(form);

    return { form: saved, buffer };
  }

  /** Forms generated for a requisition (no PDF blob), oldest first. */
  formsForRequisition(requisitionId: string) {
    return this.formRepo.find({
      where: { relatedRequisitionId: requisitionId },
      select: { id: true, formType: true, generatedAt: true },
      order: { generatedAt: 'ASC' },
    });
  }

  /**
   * A form's PDF, only if it was generated for this requisition — the link is
   * what lets the requester read it (generated forms are otherwise
   * custodian / admin only).
   */
  async requisitionFormPdf(requisitionId: string, formId: string) {
    const form = await this.formRepo
      .createQueryBuilder('f')
      .select(['f.id', 'f.formType', 'f.pdfContent'])
      .where('f.id = :formId AND f.relatedRequisitionId = :requisitionId', {
        formId,
        requisitionId,
      })
      .getOne();
    if (!form?.pdfContent) throw new NotFoundException('Document not found');
    return { formType: form.formType, buffer: form.pdfContent };
  }

  /**
   * downloadForm — Retrieves the stored PDF buffer for a previously generated form.
   * SVC: Improve — audit-reference retrieval of generated COA documents.
   */
  async downloadForm(
    id: string,
  ): Promise<{ form: GeneratedFormEntity; buffer: Buffer }> {
    const form = await this.formRepo
      .createQueryBuilder('f')
      .select(['f.id', 'f.formType', 'f.generatedAt', 'f.pdfContent'])
      .where('f.id = :id', { id })
      .getOne();

    if (!form) throw new NotFoundException(`Form record ${id} not found`);
    if (!form.pdfContent)
      throw new NotFoundException(
        `Form ${id} has no stored PDF — it may have been generated before this feature was enabled`,
      );

    return { form, buffer: form.pdfContent };
  }
}
