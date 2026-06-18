import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { GeneratedReportEntity } from './entities/generated-report.entity';
import { GeneratedFormEntity } from './entities/generated-form.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import {
  OfficialFormType,
  AuditAction,
  UserRole,
  AssetClass,
  AssetStatus,
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
  receiverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

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
    private readonly auditService: AuditService,
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
    const [data, total] = await this.formRepo.findAndCount({
      order: { generatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /**
   * getKpi — Management dashboard KPIs.
   * SVC: Improve — executive-level inventory and process metrics.
   */
  async getKpi() {
    const totalAssets = await this.assetRepo.count();
    const completeAssets = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.propertyNumber IS NOT NULL')
      .andWhere('a.serialNumber IS NOT NULL')
      .getCount();
    const inventoryAccuracy =
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
            (decidedRows.reduce((s, r) => s + parseFloat(r.hours), 0) /
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
    const totalDecided = decidedRows.length;
    const slaComplianceRate =
      totalDecided > 0 ? Math.round((withinSla / totalDecided) * 100) : 100;

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
      inventoryAccuracy,
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
  ): Promise<{ buffer: Buffer; report: GeneratedReportEntity }> {
    const buffer =
      format === 'PDF'
        ? await this.buildPdfReport(reportType)
        : await this.buildExcelReport(reportType);

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
  private async buildPdfReport(reportType: string): Promise<Buffer> {
    const { rows, headers, title } = await this.fetchReportData(reportType);

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
          `Generated: ${new Date().toLocaleString('en-PH')}  |  Cybercrime Investigation and Coordinating Center`,
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
  private async buildExcelReport(reportType: string): Promise<Buffer> {
    const { rows, headers, title } = await this.fetchReportData(reportType);

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
      `Generated: ${new Date().toLocaleString('en-PH')} | CICC`;
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
  private async fetchReportData(reportType: string): Promise<{
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
        const assets = await this.assetRepo.find({
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

      default: {
        const assets = await this.assetRepo.find({
          order: { createdAt: 'DESC' },
        });
        return {
          title: reportType.replaceAll('_', ' '),
          headers: ['Property #', 'Description', 'Status'],
          rows: assets.map((a) => [
            a.propertyNumber ?? '—',
            a.itemDescription,
            a.status,
          ]),
        };
      }
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
        buffer = await generatePTR(
          asset,
          releasingOfficer,
          input.targetOffice ?? 'Target Office/Section',
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
        const returnee = input.returneeId
          ? await getUser(input.returneeId)
          : await getCustodian(asset);
        const receiver = await getIssuer();
        buffer = await generateReceiptReturnedProperty(
          asset,
          returnee!,
          receiver,
        );
        break;
      }

      case OfficialFormType.RECEIPT_RETURNED_SEP: {
        const asset = await getAsset(input.assetId);
        const returnee = input.returneeId
          ? await getUser(input.returneeId)
          : await getCustodian(asset);
        const receiver = await getIssuer();
        buffer = await generateReceiptReturnedSEP(asset, returnee!, receiver);
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
        const items = reqs.flatMap((r) =>
          r.items.map((i) => ({
            requestNumber: r.requestNumber,
            itemDescription: i.itemDescription,
            assetType: i.assetType,
            quantity: i.quantity,
            acquisitionCost: 0,
          })),
        );
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
    const form = this.formRepo.create({
      formType,
      relatedAssetId: input.assetId ?? null,
      relatedRequisitionId: input.requisitionId ?? null,
      filePath: 'stored',
      generatedById,
      pdfContent: buffer,
    });
    const saved = await this.formRepo.save(form);

    await this.auditService.log({
      userId: generatedById,
      userRole,
      action: AuditAction.FORM_GENERATED,
      affectedRecordId: saved.id,
      affectedRecordType: 'form',
      ipAddress,
      metadata: {
        formType,
        assetId: input.assetId,
        requisitionId: input.requisitionId,
      },
    });

    return buffer;
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
