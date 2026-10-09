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
  AssetRequestStatus,
  AssetRequestType,
} from '../../../../packages/shared/src/enums';
import { AssetEntity } from '../../assets/entities/asset.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { AssetRequestAttachmentEntity } from './asset-request-attachment.entity';

/**
 * AssetRequestEntity — a return / repair / damage / loss / theft request filed
 * by the current holder of an issued asset (Database/schemas/010).
 *
 * submitted → approved (hand-over scheduled) → completed (item received or
 * incident processed, asset lifecycle updated). rejected / cancelled are terminal.
 *
 * SVC: Deliver & Support — returns, repairs and incident reporting.
 */
@Entity('asset_requests')
export class AssetRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  requestNumber!: string; // AR-YYYY-NNNN

  @Column({ type: 'uuid' })
  assetId!: string;

  @ManyToOne(() => AssetEntity, { eager: false })
  @JoinColumn({ name: 'asset_id' })
  asset!: AssetEntity;

  @Column({ type: 'uuid' })
  requestedById!: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy!: UserEntity;

  @Column({ type: 'varchar', length: 10 })
  type!: AssetRequestType;

  @Column({
    type: 'varchar',
    length: 10,
    default: AssetRequestStatus.SUBMITTED,
  })
  status!: AssetRequestStatus;

  @Column({ type: 'date' })
  preferredDate!: string; // return: preferred hand-over; incidents: date observed

  @Column({ type: 'text' })
  details!: string;

  @Column({ type: 'date', nullable: true })
  handoverDate!: string | null; // set by the custodian on approval

  @Column({ type: 'uuid', nullable: true })
  decidedById!: string | null; // approver or rejecter

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNotes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  completedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  completionNotes!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  resultingStatus!: string | null; // asset status the completion moved it to

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @OneToMany(() => AssetRequestAttachmentEntity, (a) => a.request)
  attachments!: AssetRequestAttachmentEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
