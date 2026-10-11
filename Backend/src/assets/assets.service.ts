import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
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
  AssetClass,
  AssetCondition,
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  RepairOutcome,
  RequisitionStatus,
  UserRole,
} from '../../../packages/shared/src/enums';
import { SystemConfigService } from '../system-config/system-config.service';
import { REPEAT_REPAIR_WINDOW_MONTHS } from '../../../packages/shared/src/constants';
import {
  ReplacementEligibility,
  replacementEligibility,
} from './replacement-eligibility';
import {
  AssetRepairsService,
  RepairContext,
  repairDueDate,
} from './asset-repairs.service';
import { CompleteRepairDto, IssueLoanerDto } from './dto/repair.dto';
import { UserEntity } from '../users/entities/user.entity';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';

/**
 * The asset's condition after a lifecycle move. Before this, nothing updated
 * it: an item under repair still read "serviceable", and a fixed one could
 * still read "for repair" — which also fed replacement eligibility.
 *   → under_repair                     serviceable becomes for_repair
 *   under_repair → issued / available  serviceable (it was repaired)
 *   under_repair → flagged for disposal unserviceable
 * An explicit override (e.g. a damaged item written off) wins.
 */
export function conditionAfter(
  from: AssetStatus,
  to: AssetStatus,
  current: AssetCondition,
  override?: AssetCondition,
): AssetCondition {
  if (override) return override;
  if (to === AssetStatus.UNDER_REPAIR) {
    return current === AssetCondition.SERVICEABLE
      ? AssetCondition.FOR_REPAIR
      : current;
  }
  if (from === AssetStatus.UNDER_REPAIR) {
    return to === AssetStatus.FLAGGED_FOR_DISPOSAL
      ? AssetCondition.UNSERVICEABLE
      : AssetCondition.SERVICEABLE;
  }
  return current;
}

/** Requisition states in which a replacement is still in flight. */
export const OPEN_REQUISITION_STATUSES = [
  RequisitionStatus.PENDING_SUPERVISOR,
  RequisitionStatus.PENDING_FULFILLMENT,
  RequisitionStatus.ON_HOLD,
];

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
  // ISSUED here only hands a repaired item back to the holder who still
  // carries it (updateLifecycle enforces that); anyone else gets it via AVAILABLE.
  [AssetStatus.UNDER_REPAIR]: [
    AssetStatus.ISSUED,
    AssetStatus.AVAILABLE,
    AssetStatus.FLAGGED_FOR_DISPOSAL,
  ],
  [AssetStatus.FLAGGED_FOR_DISPOSAL]: [AssetStatus.DISPOSED],
  [AssetStatus.DISPOSED]: [], // Terminal state — no further transitions
};

const CATALOGUE_ITEMS_MAX = 100;

/** One requestable line in the requisition item picker. */
export interface CatalogueItem {
  itemDescription: string;
  brand: string | null;
  itemCode: string | null;
  assetType: AssetType;
  assetClass: AssetClass;
  isSupply: boolean;
  /** Units available (PPE/SEP) or quantity on hand (IES). */
  available: number;
  conditions: string[];
  locations: string[];
}

interface RawCatalogueRow {
  itemDescription: string;
  brand: string | null;
  itemCode: string | null;
  assetType: AssetType;
  assetClass: AssetClass;
  units: string;
  quantity: string;
  conditions: string | null;
  locations: string | null;
}

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
    private readonly systemConfig: SystemConfigService,
    private readonly repairs: AssetRepairsService,
  ) {}

  // ── List all assets (paginated, optional search + status filter) ──────────
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    assetTypeScope?: AssetType[],
    requestedAssetType?: string,
    requestedAssetClass?: string,
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

    if (requestedAssetClass) {
      if (
        !Object.values(AssetClass).includes(requestedAssetClass as AssetClass)
      ) {
        throw new BadRequestException('Invalid assetClass filter.');
      }
      qb.andWhere('a.assetClass = :assetClass', {
        assetClass: requestedAssetClass,
      });
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

  // ── Catalogue items — grouped requestable inventory for the requisition picker
  // SVC: Engage — requesters choose from what CICC actually holds. Identical
  // units collapse into one row with an availability count (IES supplies sum
  // their quantity on hand). Per-unit identifiers and acquisition cost are
  // deliberately not selected (CLAUDE.md §8.4 data minimisation).
  async findCatalogueItems(opts: {
    search?: string;
    assetType?: string;
    assetClass?: string;
    limit?: number;
  }): Promise<CatalogueItem[]> {
    const { search, assetType, assetClass } = opts;
    if (
      assetType &&
      !Object.values(AssetType).includes(assetType as AssetType)
    ) {
      throw new BadRequestException('Invalid assetType filter.');
    }
    if (
      assetClass &&
      !Object.values(AssetClass).includes(assetClass as AssetClass)
    ) {
      throw new BadRequestException('Invalid assetClass filter.');
    }
    const limit = Math.min(
      Math.max(Number(opts.limit) || 50, 1),
      CATALOGUE_ITEMS_MAX,
    );

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .select('a.itemDescription', 'itemDescription')
      .addSelect('a.brand', 'brand')
      .addSelect('MIN(a.itemCode)', 'itemCode')
      .addSelect('a.assetType', 'assetType')
      .addSelect('a.assetClass', 'assetClass')
      .addSelect('COUNT(*)', 'units')
      .addSelect('COALESCE(SUM(a.quantity), 0)', 'quantity')
      // chr(31) (ASCII unit separator) — location text itself contains commas.
      .addSelect(
        'STRING_AGG(DISTINCT a.condition::text, chr(31))',
        'conditions',
      )
      .addSelect(
        'STRING_AGG(DISTINCT COALESCE(a.officeLocation, a.officeOrSection), chr(31))',
        'locations',
      )
      .where('a.status = :status', { status: AssetStatus.AVAILABLE })
      .andWhere('(a.assetClass <> :ies OR a.quantity > 0)', {
        ies: AssetClass.IES,
      });

    if (assetType) qb.andWhere('a.assetType = :assetType', { assetType });
    if (assetClass) qb.andWhere('a.assetClass = :assetClass', { assetClass });
    if (search?.trim()) {
      qb.andWhere(
        '(LOWER(a.itemDescription) LIKE LOWER(:q) OR LOWER(a.brand) LIKE LOWER(:q) OR LOWER(a.itemCode) LIKE LOWER(:q))',
        { q: `%${search.trim()}%` },
      );
    }

    const rows = await qb
      .groupBy('a.itemDescription')
      .addGroupBy('a.brand')
      .addGroupBy('a.assetType')
      .addGroupBy('a.assetClass')
      .orderBy('a.itemDescription', 'ASC')
      .limit(limit)
      .getRawMany<RawCatalogueRow>();

    const split = (s: string | null) =>
      (s ?? '')
        .split('\u001f')
        .map((x) => x.trim())
        .filter(Boolean);

    return rows.map((r) => {
      const isSupply = r.assetClass === AssetClass.IES;
      return {
        itemDescription: r.itemDescription,
        brand: r.brand ?? null,
        itemCode: r.itemCode ?? null,
        assetType: r.assetType,
        assetClass: r.assetClass,
        isSupply,
        available: Number(isSupply ? r.quantity : r.units),
        conditions: split(r.conditions),
        locations: split(r.locations),
      };
    });
  }

  // ── Does live inventory hold this item right now? ─────────────────────────
  // Used at requisition submission to tag each line inInventory, so the
  // custodian can tell picked-from-stock lines from typed-in ones.
  async isInCatalogue(
    itemDescription: string,
    assetType: AssetType,
    assetClass: AssetClass,
  ): Promise<boolean> {
    const count = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AssetStatus.AVAILABLE })
      .andWhere('LOWER(TRIM(a.itemDescription)) = :desc', {
        desc: itemDescription.trim().toLowerCase(),
      })
      .andWhere('a.assetType = :assetType', { assetType })
      .andWhere('a.assetClass = :assetClass', { assetClass })
      .andWhere('(a.assetClass <> :ies OR a.quantity > 0)', {
        ies: AssetClass.IES,
      })
      .getCount();
    return count > 0;
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
  // ── Assets assigned to one user ────────────────────────────────────────────
  // SVC: Engage — the holder's own accountability view.
  /**
   * The caller's assets, each with whether a replacement may be requisitioned
   * for it (same rule RequisitionsService.create enforces) and the number of an
   * already-open replacement requisition, so the UI never offers a second one.
   */
  async findMine(userId: string): Promise<
    Array<
      AssetEntity & {
        replacement: ReplacementEligibility & {
          openRequestNumber: string | null;
        };
        /** While under repair: where it is and when it is due back. */
        repair: {
          serviceType: string;
          serviceProvider: string | null;
          openedAt: Date;
          dueDate: string;
        } | null;
      }
    >
  > {
    const assets = await this.assetRepo.find({
      where: { custodianId: userId },
      order: { updatedAt: 'DESC' },
    });
    if (assets.length === 0) return [];

    // Raw table read (not RequisitionEntity) keeps AssetsService free of an
    // import on the requisitions module, which already depends on this one.
    const open: Array<{ assetId: string; requestNumber: string }> =
      await this.assetRepo.manager
        .createQueryBuilder()
        .select('r.replaced_asset_id', 'assetId')
        .addSelect('r.request_number', 'requestNumber')
        .from('requisitions', 'r')
        .where('r.replaced_asset_id IN (:...ids)', {
          ids: assets.map((a) => a.id),
        })
        .andWhere('r.status IN (:...statuses)', {
          statuses: OPEN_REQUISITION_STATUSES,
        })
        .getRawMany();

    const eligibility = await this.replacementEligibilityFor(assets);
    const repairs = await this.repairs.openForAssets(
      assets
        .filter((a) => a.status === AssetStatus.UNDER_REPAIR)
        .map((a) => a.id),
    );
    return assets.map((asset) => {
      const repair = repairs.get(asset.id);
      return Object.assign(asset, {
        replacement: {
          ...eligibility.get(asset.id)!,
          openRequestNumber:
            open.find((r) => r.assetId === asset.id)?.requestNumber ?? null,
        },
        repair: repair
          ? {
              serviceType: repair.serviceType,
              serviceProvider: repair.serviceProvider,
              openedAt: repair.openedAt,
              dueDate: repairDueDate(repair),
            }
          : null,
      });
    });
  }

  /**
   * Replacement eligibility for each asset, keyed by id — the one place that
   * gathers the inputs (config thresholds, recent repair counts), so the
   * holder's button and RequisitionsService's guard always agree.
   */
  async replacementEligibilityFor(
    assets: AssetEntity[],
  ): Promise<Map<string, ReplacementEligibility>> {
    const usefulLife = this.systemConfig.getUsefulLifeYears();
    const limit = this.systemConfig.getRepeatRepairLimit();
    const counts = await this.recentRepairCounts(assets.map((a) => a.id));
    const now = Date.now();
    return new Map(
      assets.map((a) => [
        a.id,
        replacementEligibility(a, usefulLife, now, {
          count: counts.get(a.id) ?? 0,
          limit,
        }),
      ]),
    );
  }

  /** Completed repairs per asset within the repeat-repair look-back window. */
  recentRepairCounts(assetIds: string[]): Promise<Map<string, number>> {
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - REPEAT_REPAIR_WINDOW_MONTHS);
    return this.repairs.repairedCountsSince(assetIds, since);
  }

  /**
   * Held assets that already qualify for a replacement but have no open
   * replacement requisition — the Property Officer's watch list.
   * SVC: Improve — surfaces items that keep failing or have aged out.
   */
  async replacementCandidates(assetTypeScope?: AssetType[]) {
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .where('a.custodianId IS NOT NULL')
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AssetStatus.ISSUED, AssetStatus.FLAGGED_FOR_DISPOSAL],
      });
    if (assetTypeScope && assetTypeScope.length > 0) {
      qb.andWhere('a.assetType IN (:...scope)', { scope: assetTypeScope });
    }
    const held = await qb.getMany();
    if (held.length === 0) return [];

    const [eligibility, counts, open] = await Promise.all([
      this.replacementEligibilityFor(held),
      this.recentRepairCounts(held.map((a) => a.id)),
      this.assetRepo.manager
        .createQueryBuilder()
        .select('r.replaced_asset_id', 'assetId')
        .from('requisitions', 'r')
        .where('r.replaced_asset_id IN (:...ids)', {
          ids: held.map((a) => a.id),
        })
        .andWhere('r.status IN (:...statuses)', {
          statuses: OPEN_REQUISITION_STATUSES,
        })
        .getRawMany<{ assetId: string }>(),
    ]);
    const requested = new Set(open.map((r) => r.assetId));
    const due = held.filter(
      (a) => eligibility.get(a.id)?.eligible && !requested.has(a.id),
    );
    const holders = await Promise.all(
      [...new Set(due.map((a) => a.custodianId!))].map((id) =>
        this.usersService.findOne(id).catch(() => null),
      ),
    );
    const byId = new Map(
      holders.filter((u): u is UserEntity => !!u).map((u) => [u.id, u]),
    );
    return due.map((a) => {
      const holder = byId.get(a.custodianId!);
      return {
        id: a.id,
        itemDescription: a.itemDescription,
        propertyNumber: a.propertyNumber ?? null,
        assetType: a.assetType,
        assetClass: a.assetClass,
        status: a.status,
        condition: a.condition,
        acquisitionDate: a.acquisitionDate ?? null,
        // Name + employee ID only (CLAUDE.md §8.4).
        holder: holder
          ? {
              name: `${holder.firstName} ${holder.lastName}`.trim(),
              employeeId: holder.employeeId,
            }
          : null,
        repairsInWindow: counts.get(a.id) ?? 0,
        eligibility: eligibility.get(a.id)!,
      };
    });
  }

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
    const existing = await this.findOne(id, assetTypeScope); // throws Not Found / Forbidden

    // Re-arm the low-stock dedup stamp: whenever a PATCH moves an IES supply
    // line back above its reorder level — by raising quantity, by LOWERING
    // reorderLevel, or both — clear lowStockNotifiedAt so checkLowStock() can
    // alert again the next time it runs low. Evaluated against the effective
    // post-patch state (patch value wins, else the stored value, else the
    // system default), so a reorderLevel-only PATCH that lifts a line out of
    // "low" still re-arms it instead of leaving the stamp stuck forever.
    // Reuses the asset already loaded above rather than issuing a second
    // findOne.
    const patch: UpdateAssetDto & {
      lowStockNotifiedAt?: Date | null;
    } = { ...dto };
    if (patch.quantity !== undefined || patch.reorderLevel !== undefined) {
      const effectiveQty = patch.quantity ?? existing.quantity;
      const effectiveThreshold =
        patch.reorderLevel ??
        existing.reorderLevel ??
        this.systemConfig.getDefaultReorderLevel();
      if (effectiveQty > effectiveThreshold) patch.lowStockNotifiedAt = null;
    }
    await this.assetRepo.update(id, patch);

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
    // Internal callers only (never from the HTTP DTO): who/what sent it to
    // repair, the repair's findings on the way out, and a condition override.
    context: RepairContext & { condition?: AssetCondition } = {},
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

    // Who holds the asset after this transition (and the hand-back-from-repair
    // rule) — resolved before anything is written.
    const backToHolder = await this.resolveIssueRecipient(asset, dto);

    // ── Business rule: a disposal flag requires documented justification ──
    // (CLAUDE.md §6 Module 1) — enforced here, not just in the UI.
    if (
      targetStatus === AssetStatus.FLAGGED_FOR_DISPOSAL &&
      !dto.notes?.trim()
    ) {
      throw new BadRequestException(
        'A justification (notes) is required to flag an asset for disposal.',
      );
    }

    // ── Apply the transition ───────────────────────────────────────────────
    const previousStatus = asset.status;
    const previousHolder = asset.custodianId;
    asset.status = targetStatus;
    asset.condition = conditionAfter(
      previousStatus,
      targetStatus,
      asset.condition,
      context.condition,
    );

    this.applyCustody(asset, dto, targetStatus, backToHolder);

    const saved = await this.assetRepo.save(asset);

    // Repair record: one per stay in under_repair, whichever screen moved it.
    if (targetStatus === AssetStatus.UNDER_REPAIR) {
      await this.repairs.open(saved, previousHolder, performedById, {
        ...context,
        problem: context.problem ?? dto.notes,
      });
    } else if (previousStatus === AssetStatus.UNDER_REPAIR) {
      await this.repairs.close(
        saved,
        targetStatus,
        performedById,
        userRole,
        ipAddress,
        {
          ...context,
          actionTaken: context.actionTaken ?? dto.notes,
        },
      );
    }

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

  /**
   * Record a repair's outcome and move the asset accordingly:
   *   repaired     → back to its holder (issued), or into stock (available)
   *                  when it has none or `returnToStock` is set
   *   unrepairable → flagged for disposal, findings as the justification;
   *                  the holder keeps accountability (and can request a
   *                  replacement) until COA relief
   * The repair record itself is closed inside updateLifecycle.
   * SVC: Deliver & Support — maintenance and repair.
   */
  async completeRepair(
    repairId: string,
    dto: CompleteRepairDto,
    user: UserEntity,
    ipAddress: string,
  ) {
    const repair = await this.repairs.load(repairId);
    this.repairs.assertCanAct(repair, user);
    if (repair.asset.status !== AssetStatus.UNDER_REPAIR) {
      throw new BadRequestException(
        `The asset is "${repair.asset.status.replaceAll('_', ' ')}", not under repair.`,
      );
    }
    // Re-checked here, not only in the DTO: the closing record must say what was done.
    if ((dto.actionTaken ?? '').trim().length < 5) {
      throw new BadRequestException(
        'Describe the work done in at least 5 characters.',
      );
    }
    const unrepairable = dto.outcome === RepairOutcome.UNREPAIRABLE;
    if (unrepairable && !dto.findings?.trim()) {
      throw new BadRequestException(
        'Record the findings — they are the justification for the disposal flag.',
      );
    }

    let target = AssetStatus.FLAGGED_FOR_DISPOSAL;
    if (!unrepairable) {
      target =
        repair.asset.custodianId && !dto.returnToStock
          ? AssetStatus.ISSUED
          : AssetStatus.AVAILABLE;
    }
    await this.updateLifecycle(
      repair.assetId,
      {
        status: target,
        notes: unrepairable
          ? `Unrepairable: ${dto.findings!.trim()}`
          : `Repaired: ${dto.actionTaken.trim()}`,
      },
      user.id,
      user.role,
      ipAddress,
      // Admin (fallback decider) is unscoped; custodians stay in their scope.
      resolveAssetTypeScope(user.role),
      { findings: dto.findings, actionTaken: dto.actionTaken },
    );
    return this.repairs.findOneForUser(repairId, user);
  }

  /**
   * Lend the holder of an item under repair an available unit of the same
   * asset type. Issued to them with an expected return date (the repair's due
   * date unless one is given), so the overdue-return watcher covers it; the
   * repair closing brings that date forward (AssetRepairsService.recallLoaner).
   * Same permission as acting on the repair.
   * SVC: Deliver & Support — continuity of service during repair.
   */
  async issueLoaner(
    repairId: string,
    dto: IssueLoanerDto,
    user: UserEntity,
    ipAddress: string,
  ) {
    const repair = await this.repairs.load(repairId);
    this.repairs.assertCanAct(repair, user);
    if (!repair.holderId) {
      throw new BadRequestException(
        'This item was in stock when it went in — there is no holder to lend a unit to.',
      );
    }
    if (
      repair.loaner &&
      repair.loaner.status === AssetStatus.ISSUED &&
      repair.loaner.custodianId === repair.holderId
    ) {
      throw new ConflictException(
        `"${repair.loaner.itemDescription}" is already out on loan for this repair.`,
      );
    }
    if (dto.assetId === repair.assetId) {
      throw new BadRequestException('An item cannot be its own loaner.');
    }

    const scope = resolveAssetTypeScope(user.role);
    const loaner = await this.findOne(dto.assetId, scope);
    if (loaner.assetType !== repair.asset.assetType) {
      throw new BadRequestException(
        `A loaner for an ${repair.asset.assetType} item must be ${repair.asset.assetType} too.`,
      );
    }
    if (loaner.assetClass === AssetClass.IES) {
      throw new BadRequestException(
        'A loaner is a unit asset, not a supply item.',
      );
    }
    if (loaner.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        `"${loaner.itemDescription}" is ${loaner.status.replaceAll('_', ' ')}, not available.`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const returnBy = (dto.expectedReturnDate ?? repairDueDate(repair)).slice(
      0,
      10,
    );
    if (returnBy < today) {
      throw new BadRequestException(
        'The loaner return date cannot be in the past.',
      );
    }

    await this.updateLifecycle(
      loaner.id,
      {
        status: AssetStatus.ISSUED,
        custodianId: repair.holderId,
        expectedReturnDate: returnBy,
        notes: `Loaner while "${repair.asset.itemDescription}" is under repair`,
      },
      user.id,
      user.role,
      ipAddress,
      scope,
    );
    await this.repairs.attachLoaner(repair, loaner, returnBy, user, ipAddress);
    return this.repairs.findOneForUser(repairId, user);
  }

  /**
   * ISSUED is reachable from AVAILABLE (a fresh issue) and from UNDER_REPAIR —
   * but only to hand a repaired item back to the holder who still carries it.
   * Giving a repaired item to someone else goes through AVAILABLE first, so
   * the original holder's accountability is closed explicitly. Returns true
   * for a hand-back.
   */
  private async resolveIssueRecipient(
    asset: AssetEntity,
    dto: UpdateLifecycleDto,
  ): Promise<boolean> {
    if (dto.status !== AssetStatus.ISSUED) return false;

    const recipient = dto.employeeId
      ? await this.usersService.findByEmployeeId(dto.employeeId)
      : null;
    if (dto.employeeId && !recipient) {
      throw new BadRequestException(
        `No user found with employee ID "${dto.employeeId}".`,
      );
    }

    if (asset.status === AssetStatus.UNDER_REPAIR) {
      if (!asset.custodianId) {
        throw new BadRequestException(
          'This repaired asset has no holder to return it to — make it "available" first, then issue it.',
        );
      }
      if (recipient && recipient.id !== asset.custodianId) {
        throw new BadRequestException(
          'A repaired asset goes back to its holder. To give it to someone else, make it "available" first.',
        );
      }
      return true;
    }

    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        `Asset cannot be issued. Current status is "${asset.status}". ` +
          `Asset must be "available" before it can be issued.`,
      );
    }
    if (recipient) asset.custodianId = recipient.id;
    else if (dto.custodianId !== undefined) asset.custodianId = dto.custodianId;
    return false;
  }

  /** Custodian and loan-date bookkeeping for the target status. */
  private applyCustody(
    asset: AssetEntity,
    dto: UpdateLifecycleDto,
    targetStatus: AssetStatus,
    backToHolder: boolean,
  ): void {
    // Record the expected return date when a loaned asset is issued — this
    // arms the overdue-return watcher (checkOverdueReturns). A fresh issue
    // without a date clears any stale value; a hand-back from repair keeps the
    // loan's existing date unless a new one is given. Always re-arm the
    // overdue stamp, or the asset would be excluded from the watcher forever.
    if (targetStatus === AssetStatus.ISSUED) {
      if (dto.expectedReturnDate) {
        asset.expectedReturnDate = new Date(dto.expectedReturnDate);
      } else if (!backToHolder) {
        asset.expectedReturnDate = null;
      }
      asset.overdueNotifiedAt = null;
      return;
    }

    if (dto.custodianId !== undefined) asset.custodianId = dto.custodianId;

    // Back in stock, returned or disposed: nobody holds it any more. AVAILABLE
    // used to keep a stale holder after a repair, so the item sat in the
    // catalogue and on the old holder's "My Assigned Assets" at once.
    if (
      targetStatus === AssetStatus.AVAILABLE ||
      targetStatus === AssetStatus.RETURNED ||
      targetStatus === AssetStatus.DISPOSED
    ) {
      asset.custodianId = null;
      asset.expectedReturnDate = null;
      asset.overdueNotifiedAt = null;
    }
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
      // `date` column vs. SQL CURRENT_DATE — an asset is overdue only once the
      // due day has fully passed, not from 00:00 on the due date itself.
      .andWhere('a.expectedReturnDate < CURRENT_DATE')
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

  // ── Low-stock threshold for one asset ────────────────────────────────────
  // Per-item reorder_level wins; the SystemConfig default reorder level is the
  // system fallback for IES lines that never had one configured.
  private lowStockThreshold(asset: AssetEntity): number {
    return asset.reorderLevel ?? this.systemConfig.getDefaultReorderLevel();
  }

  // ── Shared per-asset low-stock alert ─────────────────────────────────────
  // SVC: Deliver and Support — Module 5 "low stock" alert. Fans a single
  // notification out to every Property Custodian + every System Admin
  // (Set-deduped by user id), then stamps lowStockNotifiedAt so neither the
  // bulk watcher nor the fulfillment hook re-fires for this asset until it is
  // restocked. The caller is responsible for confirming the asset is IES,
  // at/below threshold, and unstamped before invoking this.
  private async _sendLowStockAlert(asset: AssetEntity): Promise<void> {
    const [custodians, admins] = await Promise.all([
      this.usersService.findByRole(UserRole.PROPERTY_CUSTODIAN),
      this.usersService.findByRole(UserRole.SYSTEM_ADMIN),
    ]);
    const targets = new Set<string>(
      [...custodians, ...admins].map((u) => u.id),
    );
    await Promise.all(
      [...targets].map((uid) =>
        this.notificationsService.notify(
          uid,
          NotificationAlertType.LOW_STOCK,
          'Low Stock',
          `"${asset.itemDescription}" is down to ${asset.quantity} unit(s) ` +
            `(reorder level ${this.lowStockThreshold(asset)}).`,
          asset.id,
          'asset',
        ),
      ),
    );
    await this.assetRepo.update(asset.id, { lowStockNotifiedAt: new Date() });
  }

  // ── Low-stock watcher — called by SchedulerService ──────────────────────
  // SVC: Deliver and Support — surface IES supply lines that have fallen to
  // or below their reorder level (per-item reorderLevel, else the SystemConfig
  // default reorder level). Fires exactly once per asset (dedup via
  // lowStockNotifiedAt) via the shared _sendLowStockAlert helper. Returns the
  // count of assets newly notified — never negative; SchedulerService.runWatcher
  // owns the -1 "errored" sentinel.
  async checkLowStock(): Promise<number> {
    const fallback = this.systemConfig.getDefaultReorderLevel();
    const low = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.assetClass = :cls', { cls: AssetClass.IES })
      .andWhere('a.quantity <= COALESCE(a.reorderLevel, :fallback)', {
        fallback,
      })
      .andWhere('a.lowStockNotifiedAt IS NULL')
      .getMany();

    for (const asset of low) {
      await this._sendLowStockAlert(asset);
    }

    return low.length;
  }

  // ── Single-asset low-stock check — used by requisition fulfillment ──────
  // SVC: Deliver and Support — after fulfill() decrements a supply line, this
  // gives the just-touched asset an immediate low-stock check instead of
  // waiting for the daily sweep. Returns true only when an alert was actually
  // sent (asset exists, is IES, is unstamped, and is at/below threshold).
  async notifyLowStockIfBelowThreshold(assetId: string): Promise<boolean> {
    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset || asset.assetClass !== AssetClass.IES) return false;
    if (asset.lowStockNotifiedAt) return false;
    if (asset.quantity > this.lowStockThreshold(asset)) return false;
    await this._sendLowStockAlert(asset);
    return true;
  }
}
