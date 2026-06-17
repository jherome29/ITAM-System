import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuditAction } from '../../../../packages/shared/src/enums';
import { AssetEntity } from './asset.entity';

@Entity('asset_transactions')
export class AssetTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => AssetEntity, (asset) => asset.locationHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asset_id' })
  asset!: AssetEntity;

  @Column({ type: 'uuid' })
  assetId!: string;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'uuid' })
  performedById!: string;

  @Column({ nullable: true })
  fromLocation!: string;

  @Column({ nullable: true })
  toLocation!: string;

  @Column({ nullable: true, type: 'text' })
  notes!: string;

  @CreateDateColumn()
  timestamp!: Date;
}
