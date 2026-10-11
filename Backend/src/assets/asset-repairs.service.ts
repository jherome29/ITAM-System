import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AssetRepairEntity } from './entities/asset-repair.entity';
import { AssetEntity } from './entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { UpdateRepairDto } from './dto/repair.dto';
import {
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  RepairOutcome,
  UserRole,
} from '../../../packages/shared/src/enums';
import { REPAIR_DEFAULT_TURNAROUND_DAYS } from '../../../packages/shared/src/constants';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';

// SVC: Deliver & Support — maintenance and repair. One record per stay in
// `under_repair`; AssetsService.updateLifecycle opens and closes them, so a
// repair is recorded whichever screen moved the asset.

const MS_PER_DAY = 24 * 60 * 60 * 1_000;
const DECIDING_ROLES = new Set([
  UserRole.IT_PERSONNEL,
  UserRole.PROPERTY_CUSTODIAN,
]);
// Roles that may requisition (CLAUDE.md §4) — only they can be offered a replacement.
const REQUISITION_ROLES = new Set([
  UserRole.EMPLOYEE,
  UserRole.SUPERVISOR,
  UserRole.IT_PERSONNEL,
]);

function custodianRoleFor(assetType: AssetType): UserRole {
  return assetType === AssetType.ICT
    ? UserRole.IT_PERSONNEL
    : UserRole.PROPERTY_CUSTODIAN;
}

function custodianLabelFor(assetType: AssetType): string {
  return assetType === AssetType.ICT
    ? 'IT Asset Custodian'
    : 'Property Custodian';
}

function fullName(u?: UserEntity | null): string {
  return u ? `${u.firstName} ${u.lastName}`.trim() : '';
}

/** YYYY-MM-DD of a Date in UTC (repair dates are calendar days). */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * When the repair is due: its expected completion date, or the default
 * turnaround from when it was opened.
 */
export function repairDueDate(
  r: Pick<AssetRepairEntity, 'expectedCompletionDate' | 'openedAt'>,
): string {
  if (r.expectedCompletionDate)
    return String(r.expectedCompletionDate).slice(0, 10);
  return isoDay(
    new Date(
      new Date(r.openedAt).getTime() +
        REPAIR_DEFAULT_TURNAROUND_DAYS * MS_PER_DAY,
    ),
  );
}

export interface RepairContext {
  /** Returns & Incidents request that sent it in. */
  assetRequestId?: string;
  /** What the holder reported. */
  problem?: string;
  /** Diagnosis / work recorded when the repair is closed. */
  findings?: string;
  actionTaken?: string;
}

@Injectable()
export class AssetRepairsService {
  constructor(
    @InjectRepository(AssetRepairEntity)
    private readonly repo: Repository<AssetRepairEntity>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // ── View ─────────────────────────────────────────────────────────────────
  toView(
    r: AssetRepairEntity,
    viewer?: UserEntity,
    people: Record<string, UserEntity | null> = {},
  ) {
    const due = repairDueDate(r);
    const open = !r.completedAt;
    const completedBy = r.completedById ? people[r.completedById] : null;
    return {
      id: r.id,
      assetRequestId: r.assetRequestId,
      openedAt: r.openedAt,
      reportedProblem: r.reportedProblem,
      serviceType: r.serviceType,
      serviceProvider: r.serviceProvider,
      expectedCompletionDate: r.expectedCompletionDate,
      dueDate: due,
      overdue: open && due < isoDay(new Date()),
      findings: r.findings,
      actionTaken: r.actionTaken,
      outcome: r.outcome,
      completedAt: r.completedAt,
      completedBy: completedBy
        ? {
            id: completedBy.id,
            name: fullName(completedBy),
            employeeId: completedBy.employeeId,
          }
        : null,
      // Name + employee ID only (CLAUDE.md §8.4).
      holder: r.holder
        ? {
            id: r.holder.id,
            name: fullName(r.holder),
            employeeId: r.holder.employeeId,
          }
        : null,
      asset: r.asset
        ? {
            id: r.asset.id,
            itemDescription: r.asset.itemDescription,
            propertyNumber: r.asset.propertyNumber ?? null,
            serialNumber: r.asset.serialNumber ?? null,
            assetType: r.asset.assetType,
            assetClass: r.asset.assetClass,
            status: r.asset.status,
            condition: r.asset.condition,
            components: r.asset.components ?? null,
          }
        : null,
      custodianLabel: r.asset ? custodianLabelFor(r.asset.assetType) : null,
      canAct: viewer ? this.canAct(r, viewer) : false,
    };
  }

  private async views(rows: AssetRepairEntity[], viewer?: UserEntity) {
    const ids = [
      ...new Set(
        rows.map((r) => r.completedById).filter((x): x is string => !!x),
      ),
    ];
    const users = await Promise.all(
      ids.map((id) => this.usersService.findOne(id).catch(() => null)),
    );
    const people = Object.fromEntries(ids.map((id, i) => [id, users[i]]));
    return rows.map((r) => this.toView(r, viewer, people));
  }

  private query() {
    return this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.asset', 'asset')
      .leftJoinAndSelect('r.holder', 'holder');
  }

  async load(id: string): Promise<AssetRepairEntity> {
    const r = await this.query().where('r.id = :id', { id }).getOne();
    if (!r) throw new NotFoundException(`Repair "${id}" not found`);
    return r;
  }

  // ── Access ───────────────────────────────────────────────────────────────
  private assertCanRead(r: AssetRepairEntity, user: UserEntity) {
    const scope = resolveAssetTypeScope(user.role);
    if (scope && !scope.includes(r.asset.assetType)) {
      throw new ForbiddenException(
        'This repair is outside your asset-type scope.',
      );
    }
  }

  /**
   * Who may update / close a repair: the custodian role for the asset type,
   * never the holder themself (segregation of duties). A custodian's own item
   * falls back to the System Administrator, as in Returns & Incidents.
   */
  canAct(r: AssetRepairEntity, user: UserEntity): boolean {
    if (r.completedAt || !r.asset) return false;
    if (r.holderId === user.id) return false;
    if (user.role === UserRole.SYSTEM_ADMIN) {
      return r.holder?.role === custodianRoleFor(r.asset.assetType);
    }
    const scope = resolveAssetTypeScope(user.role);
    return (
      DECIDING_ROLES.has(user.role) && !!scope?.includes(r.asset.assetType)
    );
  }

  assertCanAct(r: AssetRepairEntity, user: UserEntity) {
    if (r.completedAt) {
      throw new BadRequestException('This repair is already closed.');
    }
    if (this.canAct(r, user)) return;
    throw new ForbiddenException(
      r.holderId === user.id
        ? 'Your own item is handled by another custodian or the System Administrator.'
        : `This repair is handled by the ${custodianLabelFor(r.asset.assetType)}.`,
    );
  }

  // ── Reads ────────────────────────────────────────────────────────────────
  async list(user: UserEntity, status?: string) {
    const qb = this.query().orderBy('r.openedAt', 'DESC').take(300);
    const scope = resolveAssetTypeScope(user.role);
    if (scope) qb.where('asset.assetType IN (:...scope)', { scope });
    if (status === 'open') qb.andWhere('r.completedAt IS NULL');
    if (status === 'closed') qb.andWhere('r.completedAt IS NOT NULL');
    return this.views(await qb.getMany(), user);
  }

  async findOneForUser(id: string, user: UserEntity) {
    const r = await this.load(id);
    this.assertCanRead(r, user);
    const [view] = await this.views([r], user);
    return view;
  }

  /** Repair history of one asset, newest first (asset detail page). */
  async listForAsset(assetId: string, user: UserEntity) {
    const rows = await this.query()
      .where('r.assetId = :assetId', { assetId })
      .orderBy('r.openedAt', 'DESC')
      .getMany();
    rows.forEach((r) => this.assertCanRead(r, user));
    return this.views(rows, user);
  }

  /** Open repairs for these assets, keyed by asset id (holder's view). */
  async openForAssets(
    assetIds: string[],
  ): Promise<Map<string, AssetRepairEntity>> {
    if (assetIds.length === 0) return new Map();
    const rows = await this.repo.find({
      where: { assetId: In(assetIds), completedAt: IsNull() },
    });
    return new Map(rows.map((r) => [r.assetId, r]));
  }

  /**
   * Repairs closed as "repaired" since `since`, keyed by asset id — the count
   * the repeat-repair replacement rule measures. Assets with none are absent.
   */
  async repairedCountsSince(
    assetIds: string[],
    since: Date,
  ): Promise<Map<string, number>> {
    if (assetIds.length === 0) return new Map();
    const rows: Array<{ assetId: string; count: string }> = await this.repo
      .createQueryBuilder('r')
      .select('r.assetId', 'assetId')
      .addSelect('COUNT(*)', 'count')
      .where('r.assetId IN (:...assetIds)', { assetIds })
      .andWhere('r.outcome = :outcome', { outcome: RepairOutcome.REPAIRED })
      .andWhere('r.completedAt >= :since', { since })
      .groupBy('r.assetId')
      .getRawMany();
    return new Map(rows.map((r) => [r.assetId, Number(r.count)]));
  }

  /** Every repair (open and closed) for the Repair History report. */
  history() {
    return this.query().orderBy('r.openedAt', 'DESC').getMany();
  }

  // ── Progress ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateRepairDto,
    user: UserEntity,
    ipAddress: string,
  ) {
    const r = await this.load(id);
    this.assertCanAct(r, user);

    const changes: Partial<AssetRepairEntity> = {};
    if (dto.serviceType !== undefined) changes.serviceType = dto.serviceType;
    if (dto.serviceProvider !== undefined)
      changes.serviceProvider = dto.serviceProvider.trim() || null;
    if (dto.findings !== undefined)
      changes.findings = dto.findings.trim() || null;
    if (dto.actionTaken !== undefined)
      changes.actionTaken = dto.actionTaken.trim() || null;
    if (dto.expectedCompletionDate !== undefined) {
      changes.expectedCompletionDate = dto.expectedCompletionDate
        ? dto.expectedCompletionDate.slice(0, 10)
        : null;
      // A new due date re-arms the overdue alert.
      changes.overdueNotifiedAt = null;
    }
    await this.repo.update(r.id, changes);

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: AuditAction.REPAIR_UPDATED,
      affectedRecordId: r.id,
      affectedRecordType: 'asset_repair',
      ipAddress,
      metadata: { assetId: r.assetId, changes: Object.keys(changes) },
    });
    return this.findOneForUser(id, user);
  }

  // ── Lifecycle hooks (called by AssetsService.updateLifecycle) ────────────
  /** The asset just entered under_repair: start its repair record. */
  async open(
    asset: AssetEntity,
    holderId: string | null,
    openedById: string,
    ctx: RepairContext = {},
  ) {
    const existing = await this.repo.findOne({
      where: { assetId: asset.id, completedAt: IsNull() },
    });
    if (existing) return existing;
    return this.repo.save(
      this.repo.create({
        assetId: asset.id,
        holderId,
        assetRequestId: ctx.assetRequestId ?? null,
        openedById,
        openedAt: new Date(),
        reportedProblem: ctx.problem?.trim() || null,
      }),
    );
  }

  /**
   * The asset just left under_repair: close its record with the outcome and
   * tell the holder it went in with what happened.
   */
  async close(
    asset: AssetEntity,
    target: AssetStatus,
    closedById: string,
    userRole: UserRole,
    ipAddress: string,
    ctx: RepairContext = {},
  ) {
    const r = await this.repo.findOne({
      where: { assetId: asset.id, completedAt: IsNull() },
    });
    if (!r) return null;
    const outcome =
      target === AssetStatus.FLAGGED_FOR_DISPOSAL
        ? RepairOutcome.UNREPAIRABLE
        : RepairOutcome.REPAIRED;
    const changes: Partial<AssetRepairEntity> = {
      outcome,
      completedById: closedById,
      completedAt: new Date(),
      ...(ctx.findings?.trim() ? { findings: ctx.findings.trim() } : {}),
      ...(ctx.actionTaken?.trim()
        ? { actionTaken: ctx.actionTaken.trim() }
        : {}),
    };
    await this.repo.update(r.id, changes);
    Object.assign(r, changes);

    await this.auditService.log({
      userId: closedById,
      userRole,
      action: AuditAction.REPAIR_COMPLETED,
      affectedRecordId: r.id,
      affectedRecordType: 'asset_repair',
      ipAddress,
      metadata: { assetId: asset.id, outcome, resultingStatus: target },
    });
    await this.notifyHolder(r, asset, target);
    return r;
  }

  private async notifyHolder(
    r: AssetRepairEntity,
    asset: AssetEntity,
    target: AssetStatus,
  ) {
    if (!r.holderId) return;
    const label = custodianLabelFor(asset.assetType);
    const item = `"${asset.itemDescription}"`;
    let title = 'Repair Completed';
    let message: string;
    if (r.outcome === RepairOutcome.UNREPAIRABLE) {
      const holder = await this.usersService
        .findOne(r.holderId)
        .catch(() => null);
      title = 'Repair Not Possible';
      message =
        `${item} could not be repaired${r.findings ? ` (${r.findings})` : ''}. ` +
        'It has been flagged for disposal and stays on your accountability record until COA grants relief.' +
        (holder && REQUISITION_ROLES.has(holder.role)
          ? ' You can request a replacement from My Assigned Assets.'
          : '');
    } else if (target === AssetStatus.ISSUED) {
      message = `${item} has been repaired and is back under your custody. Collect it from the ${label}.`;
    } else {
      message = `${item} has been repaired and returned to stock — it is no longer assigned to you.`;
    }
    if (r.outcome === RepairOutcome.REPAIRED && r.actionTaken) {
      message += ` Work done: ${r.actionTaken}`;
    }
    await this.notificationsService.notify(
      r.holderId,
      NotificationAlertType.REPAIR_UPDATE,
      title,
      message,
      r.id,
      'asset_repair',
    );
  }

  // ── Watcher ──────────────────────────────────────────────────────────────
  /**
   * SVC: Improve — alert the custodian role once per repair that is past its
   * due date (expected completion, or the default turnaround). A new expected
   * date re-arms it. Returns the number newly alerted.
   */
  async checkOverdue(): Promise<number> {
    const today = isoDay(new Date());
    const open = await this.query()
      .where('r.completedAt IS NULL')
      .andWhere('r.overdueNotifiedAt IS NULL')
      .getMany();
    const overdue = open.filter((r) => r.asset && repairDueDate(r) < today);
    if (overdue.length === 0) return 0;

    const byRole = new Map<UserRole, UserEntity[]>();
    for (const role of [UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN]) {
      byRole.set(role, await this.usersService.findByRole(role));
    }
    await Promise.all(
      overdue.map(async (r) => {
        const custodians = (
          byRole.get(custodianRoleFor(r.asset.assetType)) ?? []
        ).filter((u) => u.id !== r.holderId);
        await Promise.all(
          custodians.map((u) =>
            this.notificationsService.notify(
              u.id,
              NotificationAlertType.REPAIR_OVERDUE,
              'Repair Overdue',
              `"${r.asset.itemDescription}" (${r.asset.propertyNumber ?? 'no property number'}) was due back from repair on ${repairDueDate(r)}` +
                (r.serviceProvider ? ` (${r.serviceProvider})` : '') +
                '. Update its expected completion date or record the outcome.',
              r.id,
              'asset_repair',
            ),
          ),
        );
        await this.repo.update(r.id, { overdueNotifiedAt: new Date() });
      }),
    );
    return overdue.length;
  }
}
