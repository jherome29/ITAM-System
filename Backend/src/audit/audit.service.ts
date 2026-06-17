import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';

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

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.auditRepo.findAndCount({
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
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
