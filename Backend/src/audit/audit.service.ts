import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetRequestEntity } from '../asset-requests/entities/asset-request.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn a query-string date bound into a Date, or undefined if it cannot be
 * parsed. A date-only string is expanded to the edge of that UTC day so a
 * single-day range (start === end) still matches entries logged during it.
 */
function parseDateBound(
  value: string | undefined,
  edge: 'start' | 'end',
): Date | undefined {
  if (!value) return undefined;
  const iso = DATE_ONLY.test(value)
    ? `${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`
    : value;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export interface CreateAuditLogDto {
  userId: string;
  userRole: UserRole;
  action: AuditAction;
  affectedRecordId: string;
  affectedRecordType: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AuditService — APPEND-ONLY.
 * Only exposes log() and find*() methods.
 * No update(), no delete(), no soft-delete.
 *
 * SVC: Improve — immutable audit trail for COA compliance
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    // Only to check that a record is an asset inside the caller's scope.
    @InjectRepository(AssetEntity)
    private readonly assetRepo: Repository<AssetEntity>,
    // Only to name people and records in what the screens show (withNames).
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AssetRequestEntity)
    private readonly requestRepo: Repository<AssetRequestEntity>,
    @InjectRepository(RequisitionEntity)
    private readonly requisitionRepo: Repository<RequisitionEntity>,
  ) {}

  /**
   * Creates a new audit log entry. This is the ONLY write operation allowed.
   * Called by every service after any state-changing action.
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLogEntity> {
    const entry = this.auditRepo.create(dto);
    return this.auditRepo.save(entry);
  }

  async findAll(
    page = 1,
    limit = 20,
    action?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) {
      qb.andWhere('a.action = :action', { action });
    }

    // A COA auditor's question is "everything between X and Y" — so a bare
    // "YYYY-MM-DD" from a date input is widened to cover that whole UTC day
    // (start-of-day lower bound, end-of-day inclusive upper bound). A full
    // ISO string is used verbatim; an unparseable value is dropped, never
    // turned into an `Invalid Date` comparison.
    const start = parseDateBound(startDate, 'start');
    if (start) {
      qb.andWhere('a.timestamp >= :startDate', { startDate: start });
    }
    const end = parseDateBound(endDate, 'end');
    if (end) {
      qb.andWhere('a.timestamp <= :endDate', { endDate: end });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.auditRepo.findAndCount({
      where: { userId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /**
   * Entries as the screens show them: with who did it (userName) and what it was
   * done to (recordLabel - "AR-2026-0014", "Dell Latitude (DEMO-ICT-0003)"), not
   * just the two UUIDs. Name only for people (CLAUDE.md 8.4). One lookup per kind
   * for the whole page; a record it cannot describe has no label and the screen
   * falls back to the id. Kept out of findAll() so the audit report, which
   * resolves names itself for up to 10,000 rows, does not pay for it twice.
   */
  async withNames(entries: AuditLogEntity[]) {
    if (entries.length === 0) return [];

    const idsOf = (type: string) => [
      ...new Set(
        entries
          .filter((e) => e.affectedRecordType === type)
          .map((e) => e.affectedRecordId),
      ),
    ];
    const userIds = [
      ...new Set([...entries.map((e) => e.userId), ...idsOf('users')]),
    ];
    const requestIds = idsOf('asset_request');
    const requisitionIds = idsOf('requisition');
    const assetIds = idsOf('asset');

    const [users, requests, requisitions, assets] = await Promise.all([
      this.userRepo.find({
        where: { id: In(userIds) },
        select: { id: true, firstName: true, lastName: true, employeeId: true },
      }),
      requestIds.length
        ? this.requestRepo.find({
            where: { id: In(requestIds) },
            select: { id: true, requestNumber: true },
          })
        : [],
      requisitionIds.length
        ? this.requisitionRepo.find({
            where: { id: In(requisitionIds) },
            select: { id: true, requestNumber: true },
          })
        : [],
      assetIds.length
        ? this.assetRepo.find({
            where: { id: In(assetIds) },
            select: { id: true, itemDescription: true, propertyNumber: true },
          })
        : [],
    ]);

    const person = new Map(users.map((u) => [u.id, u]));
    const requestNumber = new Map(requests.map((r) => [r.id, r.requestNumber]));
    const requisitionNumber = new Map(
      requisitions.map((r) => [r.id, r.requestNumber]),
    );
    const asset = new Map(assets.map((a) => [a.id, a]));
    const fullName = (u: UserEntity) => `${u.firstName} ${u.lastName}`.trim();

    const labelOf = (e: AuditLogEntity): string | null => {
      switch (e.affectedRecordType) {
        case 'asset_request':
          return requestNumber.get(e.affectedRecordId) ?? null;
        case 'requisition':
          return requisitionNumber.get(e.affectedRecordId) ?? null;
        case 'asset': {
          const a = asset.get(e.affectedRecordId);
          return a
            ? `${a.itemDescription}${a.propertyNumber ? ` (${a.propertyNumber})` : ''}`
            : null;
        }
        case 'users': {
          const u = person.get(e.affectedRecordId);
          return u ? `${fullName(u)} (${u.employeeId})` : null;
        }
        default:
          return null;
      }
    };

    return entries.map((e) => {
      const who = person.get(e.userId);
      return {
        ...e,
        userName: who ? fullName(who) : null,
        recordLabel: labelOf(e),
      };
    });
  }

  /** Entries of one action for several records, oldest first. */
  async findByRecordsAndAction(recordIds: string[], action: AuditAction) {
    if (recordIds.length === 0) return [];
    return this.auditRepo.find({
      where: { affectedRecordId: In(recordIds), action },
      order: { timestamp: 'ASC' },
    });
  }

  async findByRecord(recordId: string) {
    return this.auditRepo.find({
      where: { affectedRecordId: recordId },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * History of one record, on behalf of a caller's role (CLAUDE.md §8.3).
   *
   * Admin and Management already see the whole trail. IT and the property
   * roles may read only the history of an *asset inside their asset-type
   * scope* — never an arbitrary record. Account activity is recorded against
   * the user's own id, so an unscoped lookup would hand any user's login/IP
   * trail to every custodian and bypass the admin-only /audit/user/:id.
   * Anything that is not an in-scope asset is refused the same way, so the
   * response does not reveal whether the id exists.
   */
  async findRecordHistory(recordId: string, role: UserRole) {
    if (role !== UserRole.SYSTEM_ADMIN && role !== UserRole.MANAGEMENT) {
      const scope = resolveAssetTypeScope(role);
      // Default-deny: a role with no asset scope and no oversight duty.
      const asset = scope
        ? await this.assetRepo.findOne({
            where: { id: recordId, assetType: In(scope) },
            select: { id: true },
          })
        : null;
      if (!asset) {
        throw new ForbiddenException(
          'You can only view the history of assets within your scope.',
        );
      }
    }
    return this.findByRecord(recordId);
  }
}
