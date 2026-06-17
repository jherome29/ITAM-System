import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AssetClass, AssetType } from '../../../../packages/shared/src/enums';
import { RequisitionEntity } from './requisition.entity';

@Entity('requisition_items')
export class RequisitionItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => RequisitionEntity, (req) => req.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requisition_id' })
  requisition!: RequisitionEntity;

  @Column({ type: 'uuid' })
  requisitionId!: string;

  @Column({ type: 'enum', enum: AssetType })
  assetType!: AssetType;

  @Column({ type: 'enum', enum: AssetClass })
  assetClass!: AssetClass;

  @Column({ type: 'text' })
  itemDescription!: string;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ nullable: true, type: 'text' })
  justification!: string;

  @Column({ nullable: true, type: 'uuid' })
  fulfilledAssetId!: string | null;
}
