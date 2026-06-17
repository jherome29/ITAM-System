import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RequisitionEntity } from './requisition.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * RequisitionApprovalEntity — one row per approval decision.
 *
 * Supports multi-level approval and alternate approver designation.
 * Immutable after creation — new rejections or re-approvals create new rows.
 *
 * SVC: Design & Transition — approval hierarchy and authorization control
 */
@Entity('requisition_approvals')
export class RequisitionApprovalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requisitionId!: string;

  @ManyToOne(() => RequisitionEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requisition_id' })
  requisition!: RequisitionEntity;

  @Column({ type: 'uuid' })
  approverId!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'approver_id' })
  approver!: UserEntity;

  @Column({ type: 'varchar', length: 20 })
  action!: 'approved' | 'rejected'; // Snapshot — never updated

  @Column({ nullable: true, type: 'text' })
  comments!: string; // Required on rejection, optional on approval

  @CreateDateColumn()
  actionedAt!: Date; // Set once on INSERT — no @UpdateDateColumn
}
