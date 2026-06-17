import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { AuditAction, UserRole } from '../../../../packages/shared/src/enums';

/**
 * AuditLogEntity — APPEND-ONLY.
 * COA compliance: no UPDATE or DELETE ever on this table.
 * SVC: Improve — full system transaction traceability
 */
@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: UserRole })
  userRole!: UserRole;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'uuid' })
  affectedRecordId!: string;

  @Column()
  affectedRecordType!: string;

  @Column()
  ipAddress!: string;

  @Column({ nullable: true })
  userAgent!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  timestamp!: Date;
}
