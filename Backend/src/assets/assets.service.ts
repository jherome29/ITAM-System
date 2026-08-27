import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';
import {
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
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
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── List all assets (paginated, optional search + status filter) ──────────
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    assetTypeScope?: AssetType[],
    requestedAssetType?: string,
  ) {
    // Narrow within the caller's already-authorized scope only — never widen
    // it. Property Custodian's UI splits Fixed and Supplies into separate
    // list tabs; this lets either tab ask for just its own subtype. Reassigns
    // the existing `assetTypeScope` param in place so the WHERE-clause
    // construction below (and every test already covering it) needs zero
    // changes.
    if (requestedAssetType) {
      if (!Object.values(AssetType).includes(requestedAssetType as AssetType)) {
        throw new BadRequestException('Invalid assetType filter.');
      }
      if (
        assetTypeScope &&
        !assetTypeScope.includes(requestedAssetType as AssetType)
      ) {
        throw new ForbiddenException('Not authorized for this asset type.');
      }
      assetTypeScope = [requestedAssetType as AssetType];
    }

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (assetTypeScope && assetTypeScope.length > 0) {
      qb.andWhere('a.assetType IN (:...assetTypeScope)', { assetTypeScope });
    }

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
  async getStats(assetTypeScope?: AssetType[]): Promise<{
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
    const hasScope = !!assetTypeScope && assetTypeScope.length > 0;

    // Count by status
    const statusQb = this.assetRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status');
    if (hasScope) {
      statusQb.andWhere('a.assetType IN (:...assetTypeScope)', {
        assetTypeScope,
      });
    }
    const statusRows = await statusQb.getRawMany<{
      status: string;
      count: string;
    }>();

    // Count by asset class
    const classQb = this.assetRepo
      .createQueryBuilder('a')
      .select('a.assetClass', 'assetClass')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.assetClass');
    if (hasScope) {
      classQb.andWhere('a.assetType IN (:...assetTypeScope)', {
        assetTypeScope,
      });
    }
    const classRows = await classQb.getRawMany<{
      assetClass: string;
      count: string;
    }>();

    // Count by asset type
    const typeQb = this.assetRepo
      .createQueryBuilder('a')
      .select('a.assetType', 'assetType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.assetType');
    if (hasScope) {
      typeQb.andWhere('a.assetType IN (:...assetTypeScope)', {
        assetTypeScope,
      });
    }
    const typeRows = await typeQb.getRawMany<{
      assetType: string;
      count: string;
    }>();

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
  // `assetTypeScope`, when provided, restricts which asset types the caller
  // may read/act on (mirrors findAll()'s scoping — see asset-type-scope.util).
  // Every write-side method below routes through here first, so an
  // out-of-scope asset is rejected before any mutation is attempted.
  async findOne(
    id: string,
    assetTypeScope?: AssetType[],
  ): Promise<AssetEntity> {
    const asset = await this.assetRepo.findOne({
      where: { id },
      relations: { locationHistory: true },
    });
    if (!asset)
      throw new NotFoundException(`Asset with ID "${id}" was not found`);
    if (
      assetTypeScope &&
      assetTypeScope.length > 0 &&
      !assetTypeScope.includes(asset.assetType)
    ) {
      throw new ForbiddenException(
        `Asset "${id}" has asset type "${asset.assetType}", which is outside ` +
          `your permitted scope [${assetTypeScope.join(', ')}]`,
      );
    }
    return asset;
  }

  // ── Register new asset (IT Personnel only) ────────────────────────────────
  // SVC: Obtain/Build — asset registration with all CICC-required fields
  async create(
    dto: CreateAssetDto,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
    assetTypeScope?: AssetType[],
  ): Promise<AssetEntity> {
    // No existing record to run findOne()'s scope check against yet — check
    // the incoming DTO's assetType directly before anything is persisted.
    if (
      assetTypeScope &&
      assetTypeScope.length > 0 &&
      !assetTypeScope.includes(dto.assetType)
    ) {
      throw new ForbiddenException(
        `Cannot register an asset of type "${dto.assetType}"; your role is ` +
          `permitted to register [${assetTypeScope.join(', ')}] only`,
      );
    }
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
    assetTypeScope?: AssetType[],
  ): Promise<AssetEntity> {
    await this.findOne(id, assetTypeScope); // throws Not Found / Forbidden
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

    return this.findOne(id, assetTypeScope);
  }

  // ── Lifecycle transition (IT Personnel only) ───────────────────────────────
  // SVC: Deliver and Support — controlled state transitions with audit trail
  async updateLifecycle(
    id: string,
    dto: UpdateLifecycleDto,
    performedById: string,
    userRole: UserRole,
    ipAddress: string,
    assetTypeScope?: AssetType[],
  ): Promise<AssetEntity> {
    const asset = await this.findOne(id, assetTypeScope);
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

    // Record the expected return date when a loaned asset is issued — this
    // arms the overdue-return watcher (checkOverdueReturns). Omitting the
    // date on an ISSUED transition explicitly clears any stale value.
    if (targetStatus === AssetStatus.ISSUED) {
      asset.expectedReturnDate = dto.expectedReturnDate
        ? new Date(dto.expectedReturnDate)
        : null;
    }

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
      // On return, re-arm the overdue-return watcher: drop the due date and
      // the "already notified" stamp so the next loan of this asset starts
      // from a clean slate.
      if (targetStatus === AssetStatus.RETURNED) {
        asset.expectedReturnDate = null;
        asset.overdueNotifiedAt = null;
      }
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
    assetTypeScope?: AssetType[],
  ): Promise<{ qrCode: string; barcodeValue: string; assetId: string }> {
    const asset = await this.findOne(id, assetTypeScope);

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

  // ── Overdue-return watcher — called by SchedulerService ──────────────────
  // SVC: Deliver and Support — surface loaned assets that are past their
  // recorded expectedReturnDate. Fires exactly once per asset (dedup via
  // overdueNotifiedAt) and reaches the Module 5 recipient set: the current
  // holder plus every active user in the owning custodian role (IT Personnel
  // for ICT, Property Custodian for Fixed/Supplies). Returns the count of
  // assets newly notified — never negative; SchedulerService.runWatcher owns
  // the -1 "errored" sentinel.
  async checkOverdueReturns(): Promise<number> {
    const overdue = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AssetStatus.ISSUED })
      .andWhere('a.expectedReturnDate < :today', { today: new Date() })
      .andWhere('a.overdueNotifiedAt IS NULL')
      .getMany();

    await Promise.all(
      overdue.map(async (asset) => {
        const ownerRole =
          asset.assetType === AssetType.ICT
            ? UserRole.IT_PERSONNEL
            : UserRole.PROPERTY_CUSTODIAN;
        const custodians = await this.usersService.findByRole(ownerRole);

        // Dedup: a user who both holds the asset and sits in the owning
        // custodian role gets a single notification.
        const targets = new Set<string>(custodians.map((u) => u.id));
        if (asset.custodianId) targets.add(asset.custodianId);

        const dueDate = new Date(asset.expectedReturnDate as Date)
          .toISOString()
          .slice(0, 10);
        await Promise.all(
          [...targets].map((uid) =>
            this.notificationsService.notify(
              uid,
              NotificationAlertType.OVERDUE_RETURN,
              'Asset Return Overdue',
              `Asset "${asset.itemDescription}" (${asset.propertyNumber ?? asset.id}) was due back on ${dueDate}.`,
              asset.id,
              'asset',
            ),
          ),
        );
        await this.assetRepo.update(asset.id, {
          overdueNotifiedAt: new Date(),
        });
      }),
    );

    return overdue.length;
  }

  // stub — Task 6 implements this
  checkLowStock(): Promise<number> {
    return Promise.resolve(0);
  }
}
