import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
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

  async findByRecord(recordId: string) {
    return this.auditRepo.find({
      where: { affectedRecordId: recordId },
      order: { timestamp: 'ASC' },
    });
  }
}
