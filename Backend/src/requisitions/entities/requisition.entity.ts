import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import {
  RequisitionStatus,
  RequisitionType,
} from '../../../../packages/shared/src/enums';
import { UserEntity } from '../../users/entities/user.entity';
import { RequisitionItemEntity } from './requisition-item.entity';

@Entity('requisitions')
export class RequisitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  requestNumber!: string;

  @Column({ type: 'uuid' })
  requestedById!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy!: UserEntity;

  @Column({ type: 'enum', enum: RequisitionType })
  requisitionType!: RequisitionType;

  @Column({
    type: 'enum',
    enum: RequisitionStatus,
    default: RequisitionStatus.DRAFT,
  })
  status!: RequisitionStatus;

  @OneToMany(() => RequisitionItemEntity, (item) => item.requisition, {
    cascade: true,
    eager: true,
  })
  items!: RequisitionItemEntity[];

  @Column({ type: 'text' })
  justification!: string;

  @Column({ type: 'date' })
  requiredDate!: Date;

  // Set only on REPLACEMENT requisitions — the asset this request replaces.
  // Populated + validated in RequisitionsService.create() (CLAUDE.md §17).
  @Column({ nullable: true, type: 'uuid' })
  replacedAssetId!: string | null;

  @Column({ nullable: true, type: 'uuid' })
  supervisorId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  supervisorDecision!: 'approved' | 'rejected' | null;

  @Column({ nullable: true, type: 'text' })
  supervisorComments!: string;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  supervisorDecidedAt!: Date;

  @Column({ nullable: true, type: 'uuid' })
  itPersonnelId!: string;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  fulfilledAt!: Date;

  @Column({ nullable: true, type: 'text' })
  fulfillmentNotes!: string;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  submittedAt!: Date;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  slaDeadline!: Date;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  slaBreachNotifiedAt!: Date | null;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  pendingNudgeNotifiedAt!: Date | null;

  // Stamped the moment a requisition is handed to an alternate approver, by
  // either routing path (RequisitionsService.create() or checkSlaBreaches()).
  // NULL = never routed. Doubles as the "hand off at most once" guard.
  @Column({ type: 'timestamp with time zone', nullable: true })
  alternateRoutedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
