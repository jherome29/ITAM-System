import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';
import {
  AssetStatus,
  AuditAction,
  UserRole,
} from '../../../packages/shared/src/enums';

// ─── State Machine ─────────────────────────────────────────────────────────
// Valid asset lifecycle transitions per CLAUDE.md section 5.4:
//
//   [Registered] → [Available] → [Issued] → [Returned] → [Available]
//                      │              │
//                      │              └──[Under Repair] → [Available]
//                      │
//                      └──[Transferred] → [Available (new location)]
//                      └──[Flagged for Disposal] → [Disposed]

const VALID_TRANSITIONS: Record<string, AssetStatus[]> = {
  [AssetStatus.REGISTERED]: [AssetStatus.AVAILABLE],
  [AssetStatus.AVAILABLE]: [
    AssetStatus.ISSUED,
    AssetStatus.TRANSFERRED,
    AssetStatus.UNDER_REPAIR,
    AssetStatus.FLAGGED_FOR_DISPOSAL,
  ],
  [AssetStatus.ISSUED]: [
    AssetStatus.RETURNED,
    AssetStatus.UNDER_REPAIR,
    AssetStatus.FLAGGED_FOR_DISPOSAL,
  ],
  [AssetStatus.RETURNED]: [AssetStatus.AVAILABLE, AssetStatus.UNDER_REPAIR],
  [AssetStatus.TRANSFERRED]: [AssetStatus.AVAILABLE],
  [AssetStatus.UNDER_REPAIR]: [
    AssetStatus.AVAILABLE,
    AssetStatus.FLAGGED_FOR_DISPOSAL,
  ],
  [AssetStatus.FLAGGED_FOR_DISPOSAL]: [AssetStatus.DISPOSED],
  [AssetStatus.DISPOSED]: [], // Terminal state — no further transitions
};

// Map each transition to its corresponding audit action
const TRANSITION_AUDIT_ACTION: Record<string, AuditAction> = {
  [AssetStatus.AVAILABLE]: AuditAction.ASSET_UPDATED,
  [AssetStatus.ISSUED]: AuditAction.ASSET_ISSUED,
  [AssetStatus.RETURNED]: AuditAction.ASSET_RETURNED,
  [AssetStatus.TRANSFERRED]: AuditAction.ASSET_TRANSFERRED,
  [AssetStatus.UNDER_REPAIR]: AuditAction.ASSET_FLAGGED_REPAIR,
  [AssetStatus.FLAGGED_FOR_DISPOSAL]: AuditAction.ASSET_FLAGGED_DISPOSAL,
  [AssetStatus.DISPOSED]: AuditAction.ASSET_DISPOSED,
};

// SVC: Obtain/Build & Deliver and Support — asset registry and lifecycle management

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetEntity)
    private readonly assetRepo: Repository<AssetEntity>,
    @InjectRepository(AssetTransactionEntity)
    private readonly txRepo: Repository<AssetTransactionEntity>,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
  ) {}

  // ── List all assets (paginated, optional search + status filter) ──────────
  async findAll(page = 1, limit = 20, search?: string, status?: string) {
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('a.status = :status', { status: status.toLowerCase() });
    }

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        '(LOWER(a.itemDescription) LIKE LOWER(:q) OR LOWER(a.propertyNumber) LIKE LOWER(:q) OR LOWER(a.serialNumber) LIKE LOWER(:q) OR LOWER(a.brand) LIKE LOWER(:q))',
        { q },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Catalogue — available assets for employee/supervisor browse ───────────
  async findCatalogue(page = 1, limit = 20) {
    // SVC: Engage — employees see only available assets
    const [data, total] = await this.assetRepo.findAndCount({
      where: { status: AssetStatus.AVAILABLE },
      order: { itemDescription: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Asset stats — IT Personnel & Management dashboard counts ──────────────
  // SVC: Improve — inventory overview KPIs
  async getStats(): Promise<{
    total: number;
    available: number;
    issued: number;
    returned: number;
    underRepair: number;
    flaggedForDisposal: number;
    transferred: number;
    disposed: number;
    byClass: Record<string, number>;
    byType: Record<string, number>;
  }> {
    // Count by status
    const statusRows = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany<{ status: string; count: string }>();

    // Count by asset class
    const classRows = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.assetClass', 'assetClass')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.assetClass')
      .getRawMany<{ assetClass: string; count: string }>();

    // Count by asset type
    const typeRows = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.assetType', 'assetType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.assetType')
      .getRawMany<{ assetType: string; count: string }>();

    const byStatus: Record<string, number> = {};
    statusRows.forEach((r) => {
      byStatus[r.status] = parseInt(r.count, 10);
    });

    const byClass: Record<string, number> = {};
    classRows.forEach((r) => {
      byClass[r.assetClass] = parseInt(r.count, 10);
    });

    const byType: Record<string, number> = {};
    typeRows.forEach((r) => {
      byType[r.assetType] = parseInt(r.count, 10);
    });

    const total = Object.values(byStatus).reduce((s, c) => s + c, 0);

    return {
      total,
      available: byStatus[AssetStatus.AVAILABLE] ?? 0,
      issued: byStatus[AssetStatus.ISSUED] ?? 0,
      returned: byStatus[AssetStatus.RETURNED] ?? 0,
      underRepair: byStatus[AssetStatus.UNDER_REPAIR] ?? 0,
      flaggedForDisposal: byStatus[AssetStatus.FLAGGED_FOR_DISPOSAL] ?? 0,
      transferred: byStatus[AssetStatus.TRANSFERRED] ?? 0,
      disposed: byStatus[AssetStatus.DISPOSED] ?? 0,
      byClass,
      byType,
    };
  }

  // ── Single asset with full lifecycle history ───────────────────────────────
  async findOne(id: string): Promise<AssetEntity> {
    const asset = await this.assetRepo.findOne({
      where: { id },
      relations: { locationHistory: true },
    });
    if (!asset)
      throw new NotFoundException(`Asset with ID "${id}" was not found`);
    return asset;
  }

  // ── Register new asset (IT Personnel only) ────────────────────────────────
  // SVC: Obtain/Build — asset registration with all CICC-required fields
  async create(
    dto: CreateAssetDto,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<AssetEntity> {
    const asset = this.assetRepo.create({
      ...dto,
      status: AssetStatus.REGISTERED,
    });
    const saved = await this.assetRepo.save(asset);

    // Every creation must generate an audit log entry (CLAUDE.md section 8.3)
    await this.auditService.log({
      userId: performedById,
      userRole,
      action: AuditAction.ASSET_CREATED,
      affectedRecordId: saved.id,
      affectedRecordType: 'asset',
      ipAddress,
      metadata: {
        propertyNumber: saved.propertyNumber,
        assetClass: saved.assetClass,
        assetType: saved.assetType,
      },
    });

    return saved;
  }

  // ── Update editable asset fields (IT Personnel only) ─────────────────────
  // SVC: Deliver and Support — correction of asset record details
  async update(
    id: string,
    dto: UpdateAssetDto,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<AssetEntity> {
    await this.findOne(id); // throws NotFoundException if not found
    await this.assetRepo.update(id, dto);

    await this.auditService.log({
      userId: performedById,
      userRole,
      action: AuditAction.ASSET_UPDATED,
      affectedRecordId: id,
      affectedRecordType: 'asset',
      ipAddress,
      metadata: { updatedFields: Object.keys(dto) },
    });

    return this.findOne(id);
  }

  // ── Lifecycle transition (IT Personnel only) ───────────────────────────────
  // SVC: Deliver and Support — controlled state transitions with audit trail
  async updateLifecycle(
    id: string,
    dto: UpdateLifecycleDto,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<AssetEntity> {
    const asset = await this.findOne(id);
    const targetStatus = dto.status;

    // ── Business rule: validate state machine transition ──────────────────
    const allowedTargets = VALID_TRANSITIONS[asset.status];
    if (!allowedTargets.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid lifecycle transition: "${asset.status}" → "${targetStatus}". ` +
          `Allowed transitions from "${asset.status}": [${allowedTargets.join(', ') || 'none'}]`,
      );
    }

    // ── Business rule: asset cannot be issued if status !== 'available' ───
    // (already enforced by state machine above, but explicit guard for clarity)
    if (
      targetStatus === AssetStatus.ISSUED &&
      asset.status !== AssetStatus.AVAILABLE
    ) {
      throw new BadRequestException(
        `Asset cannot be issued. Current status is "${asset.status}". ` +
          `Asset must be "available" before it can be issued.`,
      );
    }

    // ── Apply the transition ───────────────────────────────────────────────
    const previousStatus = asset.status;
    asset.status = targetStatus;

    // Resolve employeeId → UUID if provided (IT Personnel don't know raw UUIDs)
    if (dto.employeeId && dto.status === AssetStatus.ISSUED) {
      const recipient = await this.usersService.findByEmployeeId(
        dto.employeeId,
      );
      if (!recipient) {
        throw new BadRequestException(
          `No user found with employee ID "${dto.employeeId}".`,
        );
      }
      asset.custodianId = recipient.id;
    } else if (dto.custodianId !== undefined) {
      asset.custodianId = dto.custodianId;
    }

    // Clear custodian on return/disposal
    if (
      targetStatus === AssetStatus.RETURNED ||
      targetStatus === AssetStatus.DISPOSED
    ) {
      asset.custodianId = null;
    }

    const saved = await this.assetRepo.save(asset);

    // ── Record transaction in asset history ────────────────────────────────
    const tx = this.txRepo.create({
      assetId: id,
      action:
        TRANSITION_AUDIT_ACTION[targetStatus] ?? AuditAction.ASSET_UPDATED,
      performedById,
      fromLocation: dto.fromLocation,
      toLocation: dto.toLocation,
      notes: dto.notes,
    });
    await this.txRepo.save(tx);

    // ── Audit log entry (CLAUDE.md section 8.3 — every state change logged)
    await this.auditService.log({
      userId: performedById,
      userRole,
      action:
        TRANSITION_AUDIT_ACTION[targetStatus] ?? AuditAction.ASSET_UPDATED,
      affectedRecordId: id,
      affectedRecordType: 'asset',
      ipAddress,
      metadata: {
        fromStatus: previousStatus,
        toStatus: targetStatus,
        custodianId: dto.custodianId,
        notes: dto.notes,
      },
    });

    return saved;
  }

  // ── Generate QR code identifier ───────────────────────────────────────────
  // SVC: Obtain/Build — QR tagging for physical asset identification
  async generateQr(
    id: string,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<{ qrCode: string; barcodeValue: string; assetId: string }> {
    const asset = await this.findOne(id);

    // Generate deterministic identifiers based on property number + UUID
    const base = asset.propertyNumber || id.replace(/-/g, '').substring(0, 12);
    const qrCode = `AIMRS-QR-${base.toUpperCase()}`;
    const barcodeValue = `AIMRS-BC-${base.toUpperCase()}`;

    await this.assetRepo.update(id, { qrCode, barcodeValue });

    // Audit log for QR generation
    await this.auditService.log({
      userId: performedById,
      userRole,
      action: AuditAction.QR_GENERATED,
      affectedRecordId: id,
      affectedRecordType: 'asset',
      ipAddress,
      metadata: { qrCode, barcodeValue },
    });

    return { qrCode, barcodeValue, assetId: id };
  }
}
