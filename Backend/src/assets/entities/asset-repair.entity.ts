import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  RepairOutcome,
  RepairServiceType,
} from '../../../../packages/shared/src/enums';
import { AssetEntity } from './asset.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * AssetRepairEntity — one stay in `under_repair` (Database/schemas/013).
 *
 * Opened by AssetsService.updateLifecycle when an asset enters under_repair and
 * closed when it leaves: `repaired` (back to its holder or into stock) or
 * `unrepairable` (flagged for disposal). Open = completedAt is null; at most
 * one open repair per asset (partial unique index).
 *
 * SVC: Deliver & Support — maintenance and repair.
 */
@Entity('asset_repairs')
export class AssetRepairEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  assetId!: string;

  @ManyToOne(() => AssetEntity, { eager: false })
  @JoinColumn({ name: 'asset_id' })
  asset!: AssetEntity;

  /** Holder when it went in; null for a stock item. */
  @Column({ type: 'uuid', nullable: true })
  holderId!: string | null;

  @ManyToOne(() => UserEntity, { eager: false, nullable: true })
  @JoinColumn({ name: 'holder_id' })
  holder!: UserEntity | null;

  /** The Returns & Incidents request that brought it in, if any. */
  @Column({ type: 'uuid', nullable: true })
  assetRequestId!: string | null;

  @Column({ type: 'uuid' })
  openedById!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  openedAt!: Date;

  @Column({ type: 'text', nullable: true })
  reportedProblem!: string | null;

  @Column({ type: 'varchar', length: 10, default: RepairServiceType.IN_HOUSE })
  serviceType!: RepairServiceType;

  @Column({ type: 'varchar', length: 150, nullable: true })
  serviceProvider!: string | null;

  @Column({ type: 'date', nullable: true })
  expectedCompletionDate!: string | null;

  @Column({ type: 'text', nullable: true })
  findings!: string | null;

  @Column({ type: 'text', nullable: true })
  actionTaken!: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  outcome!: RepairOutcome | null;

  @Column({ type: 'uuid', nullable: true })
  completedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  overdueNotifiedAt!: Date | null;

  /** Unit lent to the holder while this one is repaired (schema 014). */
  @Column({ type: 'uuid', nullable: true })
  loanerAssetId!: string | null;

  @ManyToOne(() => AssetEntity, { eager: false, nullable: true })
  @JoinColumn({ name: 'loaner_asset_id' })
  loaner!: AssetEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
